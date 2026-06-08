import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { mailConfig, sendMailOrThrow } from "../lib/mail.js";
import {
  ACCOUNT_TYPES,
  isValidAccountType,
  normalizeAccountType,
} from "../constants/account-types.js";

const COOKIE_NAME = "token";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildClientUrl(req) {
  const explicitClientUrl = normalizeBaseUrl(process.env.CLIENT_URL);
  if (explicitClientUrl) return explicitClientUrl;

  const publicAppUrl = normalizeBaseUrl(process.env.PUBLIC_APP_URL);
  if (publicAppUrl) return publicAppUrl;

  const originHeader = normalizeBaseUrl(req.headers.origin);
  if (originHeader) return originHeader;

  const refererHeader = String(req.headers.referer || "").trim();
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      return normalizeBaseUrl(refererUrl.origin);
    } catch (_) {
      // ignore invalid referer
    }
  }

  return "http://localhost:5500";
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  };
}

function cleanOptionalString(value, maxLength = 2000) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeClinicServicesForRegister(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : value.split(/[,\n/|]/);
          } catch (_) {
            return value.split(/[,\n/|]/);
          }
        })()
      : [];

  const seen = new Set();

  const services = rawValues
    .map((item) => cleanOptionalString(item, 120))
    .filter(Boolean)
    .filter((item) => {
      const key = item
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);

  return services.length ? JSON.stringify(services) : null;
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    accountType: normalizeAccountType(user.accountType),
    name: user.name || null,
    phone: user.phone || null,
    emailVerified: Boolean(user.emailVerified),
    clinicProfile: user.clinicProfile
      ? {
          id: user.clinicProfile.id,
          clinicName: user.clinicProfile.clinicName || null,
          email: user.clinicProfile.email || null,
          userId: user.clinicProfile.userId || null,
        }
      : null,
    profiles: user.profiles || [],
  };
}

async function verifyGoogleCredential(credential) {
  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();

  if (!googleClientId) {
    const error = new Error("Login com Google nÃ£o estÃ¡ configurado.");
    error.status = 500;
    throw error;
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error_description || "Credencial do Google invÃ¡lida.");
    error.status = 401;
    throw error;
  }

  if (payload.aud !== googleClientId) {
    const error = new Error("A credencial do Google foi emitida para outro app.");
    error.status = 401;
    throw error;
  }

  if (String(payload.email_verified) !== "true") {
    const error = new Error("O e-mail do Google nÃ£o estÃ¡ verificado.");
    error.status = 401;
    throw error;
  }

  const email = normalizeEmail(payload.email);

  if (!email) {
    const error = new Error("A conta Google nÃ£o retornou um e-mail.");
    error.status = 401;
    throw error;
  }

  return {
    email,
    name: payload.name || "",
    picture: payload.picture || "",
    googleSub: payload.sub || "",
  };
}

export async function googleLogin(req, res) {
  try {
    const credential = String(req.body?.credential || "").trim();
    const rawAccountType = req.body?.accountType;

    if (!credential) {
      return res.status(400).json({ message: "Credencial do Google Ã© obrigatÃ³ria." });
    }

    if (rawAccountType !== undefined && !isValidAccountType(rawAccountType)) {
      return res.status(400).json({ message: "Tipo de conta invalido." });
    }

    // Existing users keep their persisted account type. Only brand-new Google
    // accounts inherit the type selected on the registration page.
    const requestedAccountType = normalizeAccountType(rawAccountType);

    const googleUser = await verifyGoogleCredential(credential);
    const fallbackName = googleUser.email.split("@")[0] || "Profissional";
    const fullName = String(googleUser.name || fallbackName).trim() || "Profissional";
    const firstName = fullName.split(/\s+/)[0] || "Profissional";

    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
      include: {
        profiles: true,
        clinicProfile: true,
      },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          passwordHash,
          emailVerified: true,
          accountType: requestedAccountType,
          name: firstName,
          googleSub: googleUser.googleSub || null,
          clinicProfile:
            requestedAccountType === ACCOUNT_TYPES.CLINIC
              ? {
                  create: {
                    clinicName: fullName,
                    responsibleName: fullName,
                    email: googleUser.email,
                    phone: null,
                    whatsapp: null,
                  },
                }
              : undefined,
        },
        include: {
          profiles: true,
          clinicProfile: true,
        },
      });
    } else {
      const userUpdateData = {};

      if (!user.emailVerified) userUpdateData.emailVerified = true;
      if (!user.name) userUpdateData.name = firstName;
      if (!user.googleSub && googleUser.googleSub) userUpdateData.googleSub = googleUser.googleSub;

      if (Object.keys(userUpdateData).length) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: userUpdateData,
          include: {
            profiles: true,
            clinicProfile: true,
          },
        });
      }
    }

    if (
      normalizeAccountType(user.accountType) === ACCOUNT_TYPES.CLINIC &&
      !user.clinicProfile
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          clinicProfile: {
            create: {
              clinicName: fullName,
              responsibleName: fullName,
              email: user.email,
              phone: user.phone || null,
              whatsapp: user.phone || null,
            },
          },
        },
        include: {
          profiles: true,
          clinicProfile: true,
        },
      });
    }

    if (normalizeAccountType(user.accountType) === ACCOUNT_TYPES.PHYSIO && !user.profiles?.length) {
      const profile = await prisma.profile.create({
        data: {
          name: firstName,
          specialty: "NÃ£o informado",
          city: "NÃ£o informado",
          neighborhood: null,
          phone: user.phone || null,
          bio: "Perfil criado com Google. Complete seus dados profissionais para aparecer melhor nas buscas.",
          photoUrl: googleUser.picture || null,
          publicEmail: googleUser.email,
          ownerUserId: user.id,
          isClaimed: true,
        },
      });

      user = {
        ...user,
        profiles: [profile],
      };
    }

    if (normalizeAccountType(user.accountType) === ACCOUNT_TYPES.CLINIC) {
      console.info("Clinic Google signup/login resolved records:", {
        userId: user.id,
        clinicProfileId: user.clinicProfile?.id || null,
      });
    }

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "NÃ£o foi possÃ­vel entrar com Google.",
    });
  }
}


export async function register(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const rawAccountType = req.body?.accountType;
    const name = cleanOptionalString(req.body?.name, 160);
    const phone = cleanOptionalString(req.body?.phone ?? req.body?.whatsapp, 40);

    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha sÃ£o obrigatÃ³rios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "A senha precisa ter pelo menos 6 caracteres." });
    }

    if (rawAccountType !== undefined && !isValidAccountType(rawAccountType)) {
      return res.status(400).json({ message: "Tipo de conta invalido." });
    }

    const accountType = normalizeAccountType(rawAccountType);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Este e-mail jÃ¡ estÃ¡ cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (accountType === ACCOUNT_TYPES.CLINIC) {
      console.info("Clinic signup payload received:", {
        email,
        accountType,
        clinicName: cleanOptionalString(req.body?.clinicName || req.body?.name, 160),
        responsibleName: cleanOptionalString(req.body?.responsibleName, 160),
        city: cleanOptionalString(req.body?.city, 120),
        neighborhood: cleanOptionalString(req.body?.neighborhood, 120),
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        accountType,
        name,
        phone,
        clinicProfile:
          accountType === ACCOUNT_TYPES.CLINIC
            ? {
                create: {
                  clinicName: cleanOptionalString(req.body?.clinicName || req.body?.name, 160),
                  responsibleName: cleanOptionalString(req.body?.responsibleName, 160),
                  email,
                  address: cleanOptionalString(req.body?.address, 200),
                  city: cleanOptionalString(req.body?.city, 120),
                  neighborhood: cleanOptionalString(req.body?.neighborhood, 120),
                  phone,
                  whatsapp: cleanOptionalString(req.body?.whatsapp ?? req.body?.phone, 40),
                  services: normalizeClinicServicesForRegister(
                    req.body?.specialties ?? req.body?.services
                  ),
                  logoUrl: cleanOptionalString(req.body?.logoUrl, 2000000),
                  description: cleanOptionalString(req.body?.description, 2000),
                },
              }
            : undefined,
      },
      include: {
        profiles: true,
        clinicProfile: true,
      },
    });

    if (accountType === ACCOUNT_TYPES.CLINIC) {
      console.info("Clinic signup created records:", {
        userId: user.id,
        clinicProfileId: user.clinicProfile?.id || null,
      });
    }

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(201).json({
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: error.message || "NÃ£o foi possÃ­vel criar a conta." });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha sÃ£o obrigatÃ³rios." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profiles: true,
        clinicProfile: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "E-mail ou senha invÃ¡lidos." });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({ message: "E-mail ou senha invÃ¡lidos." });
    }

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: error.message || "NÃ£o foi possÃ­vel entrar." });
  }
}

export async function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res.json({ message: "SessÃ£o encerrada." });
}

export async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        profiles: true,
        clinicProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "UsuÃ¡rio nÃ£o encontrado." });
    }

    return res.json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ message: error.message || "NÃ£o foi possÃ­vel carregar o usuÃ¡rio." });
  }
}

export async function forgotPassword(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: "E-mail Ã© obrigatÃ³rio." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // Generic response so people cannot check which emails exist.
    if (!user) {
      return res.json({
        message: "Se o e-mail existir, o link de recuperaÃ§Ã£o foi enviado.",
      });
    }

    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const clientUrl = buildClientUrl(req);
    const resetLink = `${clientUrl}/update-password.html?token=${encodeURIComponent(token)}`;

    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    await sendMailOrThrow({
      from: mailConfig.from || mailConfig.user,
      sender: mailConfig.user,
      to: email,
      replyTo: mailConfig.user,
      subject: "RecuperaÃ§Ã£o de senha - PhysioPipeline",
      text: [
        "RecuperaÃ§Ã£o de senha",
        "",
        "Recebemos uma solicitaÃ§Ã£o para redefinir sua senha no PhysioPipeline.",
        `Abra este link para criar uma nova senha: ${resetLink}`,
        "",
        "Este link expira em 30 minutos.",
        "Se vocÃª nÃ£o solicitou isso, ignore este e-mail.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>RecuperaÃ§Ã£o de senha</h2>
          <p>Recebemos uma solicitaÃ§Ã£o para redefinir sua senha no <strong>PhysioPipeline</strong>.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">
              Criar nova senha
            </a>
          </p>
          <p>Este link expira em <strong>30 minutos</strong>.</p>
          <p>Se vocÃª nÃ£o solicitou isso, ignore este e-mail.</p>
        </div>
      `,
    });

    return res.json({
      message: "Se o e-mail existir, o link de recuperaÃ§Ã£o foi enviado.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: error.message || "NÃ£o foi possÃ­vel enviar o link de recuperaÃ§Ã£o.",
    });
  }
}

export async function updatePassword(req, res) {
  try {
    const token = String(req.body?.token || req.body?.accessToken || "").trim();
    const password = String(req.body?.password || "");

    if (!token || !password) {
      return res.status(400).json({ message: "Token e nova senha sÃ£o obrigatÃ³rios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ message: "Token invÃ¡lido ou expirado." });
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
      return res.status(400).json({ message: "Token expirado. Solicite um novo link." });
    }

    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true },
    });

    if (!user) {
      await prisma.passwordResetToken.deleteMany({ where: { email: resetToken.email } });
      return res.status(400).json({ message: "Token invÃ¡lido ou expirado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { email: resetToken.email },
      }),
    ]);

    return res.json({ message: "Senha atualizada com sucesso." });
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({
      message: error.message || "NÃ£o foi possÃ­vel atualizar a senha.",
    });
  }
}




