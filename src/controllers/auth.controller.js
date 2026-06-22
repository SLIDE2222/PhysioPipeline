import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../lib/prisma.js";
import { mailConfig, sendMailOrThrow } from "../lib/mail.js";
import {
  ACCOUNT_TYPES,
  isValidAccountType,
  normalizeAccountType,
} from "../constants/account-types.js";

const COOKIE_NAME = "token";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();

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
      return normalizeBaseUrl(new URL(refererHeader).origin);
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

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    name: user.name || null,
    phone: user.phone || null,
    accountType: normalizeAccountType(user.accountType),
    profiles: Array.isArray(user.profiles) ? user.profiles : [],
    clinicProfile: user.clinicProfile || null,
  };
}

function getGoogleSub(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const googleIdentity = identities.find((identity) => identity?.provider === "google");
  return (
    user?.app_metadata?.provider_id ||
    user?.user_metadata?.sub ||
    googleIdentity?.id ||
    null
  );
}

async function getSupabaseUserFromAccessToken(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const error = new Error("Supabase auth is not configured on the backend.");
    error.status = 500;
    throw error;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    const authError = new Error(error?.message || "Supabase session is invalid.");
    authError.status = 401;
    throw authError;
  }

  return data.user;
}

function buildRedirectUrlForUser(user) {
  if (normalizeAccountType(user?.accountType) === ACCOUNT_TYPES.CLINIC && user?.clinicProfile?.id) {
    return `profile.html?type=clinic&id=${encodeURIComponent(user.clinicProfile.id)}`;
  }

  const physioProfileId = user?.profiles?.[0]?.id || null;
  if (physioProfileId) {
    return `profile.html?id=${encodeURIComponent(physioProfileId)}`;
  }

  return "profile.html";
}

async function resolveUserAccountAfterGoogleLogin({ supabaseUser, requestedAccountType }) {
  const email = normalizeEmail(supabaseUser.email);

  if (!email) {
    const error = new Error("Supabase user is missing an email.");
    error.status = 400;
    throw error;
  }

  const displayName = cleanOptionalString(
    supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      supabaseUser.user_metadata?.clinicName ||
      supabaseUser.user_metadata?.clinic_name ||
      supabaseUser.user_metadata?.preferred_username
  );
  const phone = cleanOptionalString(
    supabaseUser.phone || supabaseUser.user_metadata?.phone || supabaseUser.user_metadata?.whatsapp,
    80
  );
  const googleSub = cleanOptionalString(getGoogleSub(supabaseUser), 255);
  const randomPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const normalizedRequestedAccountType = isValidAccountType(requestedAccountType)
    ? requestedAccountType
    : ACCOUNT_TYPES.PHYSIO;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        ...(googleSub ? [{ googleSub }] : []),
        { email },
      ],
    },
    include: {
      clinicProfile: true,
      profiles: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const existingClinic = existingUser?.clinicProfile || null;
  const existingPhysio =
    existingUser?.profiles?.[0] ||
    await prisma.profile.findFirst({
      where: {
        OR: [
          ...(existingUser?.id ? [{ ownerUserId: existingUser.id }] : []),
          { publicEmail: { equals: email, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  const resolvedAccountType = existingClinic
    ? ACCOUNT_TYPES.CLINIC
    : existingPhysio
      ? ACCOUNT_TYPES.PHYSIO
      : normalizedRequestedAccountType;

  console.log("Google login user:", email, supabaseUser.id || googleSub || null);
  console.log("existing clinic:", existingClinic);
  console.log("existing physio:", existingPhysio);
  console.log("resolved accountType:", resolvedAccountType);

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: Boolean(supabaseUser.email_confirmed_at),
          name: displayName || existingUser.name || undefined,
          phone: phone || existingUser.phone || undefined,
          googleSub: googleSub || existingUser.googleSub || undefined,
          accountType: existingClinic
            ? ACCOUNT_TYPES.CLINIC
            : existingPhysio
              ? ACCOUNT_TYPES.PHYSIO
              : resolvedAccountType,
        },
        include: {
          clinicProfile: true,
          profiles: {
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash: randomPasswordHash,
          emailVerified: Boolean(supabaseUser.email_confirmed_at),
          name: displayName,
          phone,
          googleSub,
          accountType: resolvedAccountType,
        },
        include: {
          clinicProfile: true,
          profiles: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

  const redirectUrl = buildRedirectUrlForUser(user);

  console.log("redirectUrl:", redirectUrl);

  return {
    user,
    redirectUrl,
    clinicProfileId: user.clinicProfile?.id || null,
    physioProfileId: user.profiles?.[0]?.id || null,
    accountType: normalizeAccountType(user.accountType),
  };
}

async function upsertSupabaseUserSession({ accessToken, requestedAccountType }) {
  const supabaseUser = await getSupabaseUserFromAccessToken(accessToken);
  return resolveUserAccountAfterGoogleLogin({
    supabaseUser,
    requestedAccountType,
  });
}

function formatClinicLinkNotification(link, accountType) {
  const clinicName = link.clinic?.clinicName || "A clínica";
  const profileName = link.profile?.name || "fisioterapeuta";
  const clinicLocation = [link.clinic?.city, link.clinic?.neighborhood].filter(Boolean).join(" - ");

  if (accountType === ACCOUNT_TYPES.CLINIC) {
    const statusText = link.status === "ACCEPTED"
      ? `${profileName} aceitou o vinculo com sua clinica.`
      : link.status === "REJECTED"
        ? `${profileName} recusou o vinculo com sua clinica.`
        : link.status === "UNLINKED"
          ? `${profileName} foi desvinculado da sua clinica.`
          : `${profileName} solicitou vínculo com sua clínica.`;

    return {
      id: link.id,
      recipientUserId: link.clinic?.userId || null,
      type: "clinic_link_request",
      status: link.status,
      notificationStatus: link.readByClinic ? "read" : "unread",
      unread: !link.readByClinic,
      title: "Nova solicitação de vínculo",
      message: statusText,
      icon: "physiopipeline-p",
      linkId: link.id,
      relatedRequestId: link.id,
      relatedPhysioId: link.profileId,
      profileId: link.profileId,
      profileName,
      requesterName: link.profile?.name || null,
      requesterCity: link.profile?.city || null,
      requesterNeighborhood: link.profile?.neighborhood || null,
      requesterSpecialty: link.profile?.specialty || null,
      requesterBio: link.profile?.bio || null,
      requesterAvatarUrl: link.profile?.photoUrl || null,
      relatedClinicId: link.clinicId,
      clinicId: link.clinicId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }

  if (link.status === "PENDING") {
    return {
      id: link.id,
      recipientUserId: link.profile?.ownerUserId || null,
      type: "clinic_link_request",
      status: link.status,
      notificationStatus: link.readByPhysio ? "read" : "unread",
      unread: !link.readByPhysio,
      title: "Nova solicitação de vínculo",
      message: `${clinicName} solicitou vínculo com seu perfil.`,
      icon: "physiopipeline-p",
      linkId: link.id,
      relatedRequestId: link.id,
      relatedPhysioId: link.profileId,
      relatedClinicId: link.clinicId,
      clinicId: link.clinicId,
      clinicName,
      clinicLocation,
      clinicCity: link.clinic?.city || null,
      clinicNeighborhood: link.clinic?.neighborhood || null,
      clinicPhone: link.clinic?.phone || null,
      clinicWhatsapp: link.clinic?.whatsapp || null,
      clinicAddress: link.clinic?.address || null,
      clinicResponsibleName: link.clinic?.responsibleName || null,
      clinicLogoUrl: link.clinic?.logoUrl || null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }

  return {
    id: link.id,
    recipientUserId: link.profile?.ownerUserId || null,
    type: "clinic_link_request_response",
    status: link.status,
    notificationStatus: link.readByPhysio ? "read" : "unread",
    unread: !link.readByPhysio,
    title: "Solicitação de vínculo",
    message: link.status === "ACCEPTED"
      ? `Sua solicitação de vínculo com ${clinicName} foi aceita.`
      : link.status === "REJECTED"
        ? `Sua solicitação de vínculo com ${clinicName} foi recusada.`
        : `Seu vínculo com ${clinicName} foi atualizado.`,
    icon: "physiopipeline-p",
    linkId: link.id,
    relatedRequestId: link.id,
    relatedPhysioId: link.profileId,
    relatedClinicId: link.clinicId,
    clinicId: link.clinicId,
    clinicName,
    clinicLocation,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

export async function register(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const accountType = normalizeAccountType(req.body?.accountType);
    const name = cleanOptionalString(req.body?.name, 120);
    const phone = cleanOptionalString(req.body?.phone || req.body?.whatsapp, 80);

    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Este e-mail ja esta cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        accountType,
        name,
        phone,
      },
      include: {
        clinicProfile: true,
        profiles: true,
      },
    });

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: error.message || "Nao foi possivel criar a conta." });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clinicProfile: true,
        profiles: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: "E-mail ou senha invalidos." });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({ message: "E-mail ou senha invalidos." });
    }

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: error.message || "Nao foi possivel entrar." });
  }
}

export async function googleLogin(req, res) {
  try {
    const credential = String(req.body?.credential || "").trim();

    if (!credential) {
      return res.status(400).json({ message: "Credencial do Google obrigatoria." });
    }

    // This route is kept for backwards compatibility with older frontend code.
    // The primary production flow now uses Supabase OAuth and /auth/supabase.
    let payload = null;
    try {
      const [, tokenPayload] = credential.split(".");
      payload = tokenPayload
        ? JSON.parse(Buffer.from(tokenPayload, "base64url").toString("utf8"))
        : null;
    } catch (_) {
      payload = null;
    }

    const email = normalizeEmail(payload?.email);
    if (!email) {
      return res.status(400).json({ message: "Nao foi possivel identificar o e-mail do Google." });
    }

    const { user, redirectUrl, accountType, clinicProfileId, physioProfileId } =
      await resolveUserAccountAfterGoogleLogin({
        supabaseUser: {
          email,
          email_confirmed_at: new Date().toISOString(),
          user_metadata: {
            name: payload?.name || payload?.given_name || null,
            full_name: payload?.name || null,
          },
          identities: payload?.sub
            ? [{ provider: "google", id: payload.sub }]
            : [],
          app_metadata: {
            provider_id: payload?.sub || null,
          },
        },
        requestedAccountType: normalizeAccountType(req.body?.accountType),
      });

    console.log("Google login user:", user.email, user.id);
    console.log("existing clinic:", user.clinicProfile || null);
    console.log("existing physio:", user.profiles?.[0] || null);
    console.log("resolved accountType:", accountType);
    console.log("redirectUrl:", redirectUrl);

    if (clinicProfileId) {
      console.log("Google login clinicProfileId:", clinicProfileId);
    }

    if (physioProfileId) {
      console.log("Google login physioProfileId:", physioProfileId);
    }

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      token,
      redirectUrl,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ message: error.message || "Nao foi possivel entrar com Google." });
  }
}

export async function supabaseLogin(req, res) {
  try {
    const accessToken = String(req.body?.accessToken || "").trim();
    const requestedAccountType = normalizeAccountType(req.body?.accountType);

    if (!accessToken) {
      return res.status(400).json({ message: "Access token do Supabase obrigatorio." });
    }

    const { user, redirectUrl, accountType, clinicProfileId, physioProfileId } = await upsertSupabaseUserSession({
      accessToken,
      requestedAccountType,
    });

    console.log("Google login user:", user.email, user.id);
    console.log("existing clinic:", user.clinicProfile || null);
    console.log("existing physio:", user.profiles?.[0] || null);
    console.log("resolved accountType:", accountType);
    console.log("redirectUrl:", redirectUrl);

    if (clinicProfileId) {
      console.log("Google login clinicProfileId:", clinicProfileId);
    }

    if (physioProfileId) {
      console.log("Google login physioProfileId:", physioProfileId);
    }

    const token = createToken(user);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      token,
      redirectUrl,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Supabase login error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Nao foi possivel autenticar com Supabase.",
    });
  }
}

export async function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res.json({ message: "Sessao encerrada." });
}

export async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        clinicProfile: true,
        profiles: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado." });
    }

    return res.json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ message: error.message || "Nao foi possivel carregar o usuario." });
  }
}

export async function forgotPassword(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: "E-mail e obrigatorio." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.json({
        message: "Se o e-mail existir, o link de recuperacao foi enviado.",
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
      subject: "Recuperacao de senha - PhysioPipeline",
      text: [
        "Recuperacao de senha",
        "",
        "Recebemos uma solicitacao para redefinir sua senha no PhysioPipeline.",
        `Abra este link para criar uma nova senha: ${resetLink}`,
        "",
        "Este link expira em 30 minutos.",
        "Se voce nao solicitou isso, ignore este e-mail.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>Recuperacao de senha</h2>
          <p>Recebemos uma solicitacao para redefinir sua senha no <strong>PhysioPipeline</strong>.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">
              Criar nova senha
            </a>
          </p>
          <p>Este link expira em <strong>30 minutos</strong>.</p>
          <p>Se voce nao solicitou isso, ignore este e-mail.</p>
        </div>
      `,
    });

    return res.json({
      message: "Se o e-mail existir, o link de recuperacao foi enviado.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: error.message || "Nao foi possivel enviar o link de recuperacao.",
    });
  }
}

export async function updatePassword(req, res) {
  try {
    const token = String(req.body?.token || req.body?.accessToken || "").trim();
    const password = String(req.body?.password || "");

    if (!token || !password) {
      return res.status(400).json({ message: "Token e nova senha sao obrigatorios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ message: "Token invalido ou expirado." });
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
      return res.status(400).json({ message: "Token invalido ou expirado." });
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
      message: error.message || "Nao foi possivel atualizar a senha.",
    });
  }
}

export async function notifications(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        clinicProfile: true,
        profiles: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado." });
    }

    const accountType = normalizeAccountType(user.accountType);
    let links = [];

    console.log("notification lookup user id:", user.id);
    console.log("notification lookup account type:", accountType);
    console.log("notification lookup clinic profile id:", user.clinicProfile?.id || null);

    if (accountType === ACCOUNT_TYPES.CLINIC) {
      links = await prisma.clinicPhysiotherapistLink.findMany({
        where: {
          OR: [
            ...(user.clinicProfile?.id ? [{ clinicId: user.clinicProfile.id }] : []),
            { clinic: { userId: user.id } },
          ],
          status: { in: ["PENDING", "ACCEPTED", "REJECTED", "UNLINKED"] },
          readByClinic: false,
        },
        include: { profile: true, clinic: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });
    } else {
      const profile = user.profiles?.[0] || await prisma.profile.findFirst({
        where: { ownerUserId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (profile?.id) {
        links = await prisma.clinicPhysiotherapistLink.findMany({
          where: {
            profileId: profile.id,
            status: { in: ["PENDING", "ACCEPTED", "REJECTED", "UNLINKED"] },
            readByPhysio: false,
          },
          include: { clinic: true, profile: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        });
      }
    }

    const notificationItems = links.map((link) =>
      formatClinicLinkNotification(link, accountType)
    );

    console.log("notification lookup links found:", links.length);

    return res.json({
      notifications: notificationItems,
      unreadCount: notificationItems.filter((item) => item.unread).length,
    });
  } catch (error) {
    console.error("Notifications route error:", error);
    return res.status(500).json({
      message: error.message || "Nao foi possivel carregar notificacoes.",
    });
  }
}

async function updateNotificationReadState(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        clinicProfile: true,
        profiles: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado." });
    }

    const link = await prisma.clinicPhysiotherapistLink.findUnique({
      where: { id: req.params.id },
      include: { clinic: true, profile: true },
    });

    if (!link) {
      return res.status(404).json({ message: "Notificacao nao encontrada." });
    }

    const accountType = normalizeAccountType(user.accountType);
    const ownedProfile = user.profiles?.[0] || await prisma.profile.findFirst({
      where: { ownerUserId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const canReadAsClinic = accountType === ACCOUNT_TYPES.CLINIC && user.clinicProfile?.id === link.clinicId;
    const canReadAsPhysio = ownedProfile?.id === link.profileId;

    if (!canReadAsClinic && !canReadAsPhysio) {
      return res.status(403).json({ message: "Voce nao pode alterar esta notificacao." });
    }

    const updated = await prisma.clinicPhysiotherapistLink.update({
      where: { id: link.id },
      data: {
        ...(canReadAsClinic ? { readByClinic: true } : {}),
        ...(canReadAsPhysio ? { readByPhysio: true } : {}),
      },
      include: { clinic: true, profile: true },
    });

    return res.json({ notification: formatClinicLinkNotification(updated, accountType) });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({
      message: error.message || "Nao foi possivel atualizar a notificacao.",
    });
  }
}

export async function markNotificationRead(req, res) {
  return updateNotificationReadState(req, res);
}

export async function dismissNotification(req, res) {
  return updateNotificationReadState(req, res);
}
