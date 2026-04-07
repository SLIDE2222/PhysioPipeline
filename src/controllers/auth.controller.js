import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { sendMailOrThrow, mailConfig } from "../lib/mail.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  specialty: z.string().min(2),
  city: z.string().min(2),
  neighborhood: z.string().min(2).optional().or(z.literal("")).nullable(),
  phone: z.string().min(8),
  bio: z.string().min(2).optional().or(z.literal("")).nullable(),
  instagram: z.string().url().optional().or(z.literal("")).nullable(),
  linkedin: z.string().url().optional().or(z.literal("")).nullable(),
  photoUrl: z.string().optional().or(z.literal("")).nullable(),
  publicEmail: z.string().email().optional().or(z.literal("")).nullable(),
  attendance: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const explicitSameSite = String(process.env.COOKIE_SAMESITE || "").trim().toLowerCase();
  const explicitSecure = String(process.env.COOKIE_SECURE || "").trim().toLowerCase();

  const sameSite = ["lax", "strict", "none"].includes(explicitSameSite)
    ? explicitSameSite
    : (isProduction ? "none" : "lax");

  const secure = explicitSecure
    ? ["1", "true", "yes", "on"].includes(explicitSecure)
    : (sameSite === "none" ? true : isProduction);

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setAuthCookie(res, token) {
  res.cookie("token", token, getCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie("token", {
    ...getCookieOptions(),
    maxAge: undefined,
  });
}

async function resolveUserProfiles(userId, userEmail) {
  const byOwner = await prisma.profile.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
  });

  if (byOwner.length > 0) return byOwner;

  return prisma.profile.findMany({
    where: {
      publicEmail: { equals: userEmail, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid registration data.",
      errors: parsed.error.flatten(),
    });
  }

  const {
    email,
    password,
    name,
    specialty,
    city,
    neighborhood,
    phone,
    bio,
    instagram,
    linkedin,
    photoUrl,
    publicEmail,
    attendance,
  } = parsed.data;

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

  if (existing) {
    return res.status(409).json({ message: "Email already in use." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        emailVerified: true,
      },
      select: { id: true, email: true, emailVerified: true, createdAt: true },
    });

    const profile = await tx.profile.create({
      data: {
        name,
        specialty,
        city,
        neighborhood: clean(neighborhood),
        phone: clean(phone),
        bio: clean(bio),
        instagram: clean(instagram),
        linkedin: clean(linkedin),
        photoUrl: clean(photoUrl),
        publicEmail: clean(publicEmail) || normalizedEmail,
        attendance: clean(attendance),
        ownerUserId: user.id,
        isClaimed: true,
      },
    });

    return { user, profile };
  });

  const token = signToken(created.user);
  setAuthCookie(res, token);

  return res.status(201).json({
    token,
    user: {
      ...created.user,
      profiles: [created.profile],
    },
    profile: created.profile,
  });
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid login data." });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const profiles = await resolveUserProfiles(user.id, user.email);
  if (!profiles.length) {
    return res.status(403).json({
      message: "This account does not have a linked profile yet. Create a profile before logging in.",
      code: "PROFILE_REQUIRED",
    });
  }

  const token = signToken(user);
  setAuthCookie(res, token);

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      profiles,
    },
  });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const profiles = await resolveUserProfiles(user.id, user.email);

  return res.json({
    user: {
      ...user,
      profiles,
    },
  });
}

export async function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ message: "Logged out." });
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const updatePasswordSchema = z.object({
  token: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  password: z.string().min(6),
});

const resetStore = globalThis.__physioResetStore || new Map();
globalThis.__physioResetStore = resetStore;

export async function forgotPassword(req, res) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid e-mail." });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    return res.status(404).json({ message: "E-mail not found." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  resetStore.set(token, {
    userId: user.id,
    expiresAt: Date.now() + 1000 * 60 * 60,
  });

  const resetLink = `${mailConfig.clientUrl}/update-password.html?token=${encodeURIComponent(token)}`;

  await sendMailOrThrow({
    from: mailConfig.from || mailConfig.user,
    to: user.email,
    replyTo: mailConfig.user,
    subject: "Recuperação de senha | PhysioPipeline",
    text: [
      "Você pediu para redefinir sua senha.",
      "",
      `Abra este link para criar uma nova senha: ${resetLink}`,
      "",
      "Se você não pediu isso, ignore este e-mail.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Recuperação de senha</h2>
        <p>Você pediu para redefinir sua senha.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">Criar nova senha</a></p>
        <p>Se você não pediu isso, ignore este e-mail.</p>
      </div>
    `,
  });

  return res.json({ message: "Recovery e-mail sent.", emailSent: true });
}

export async function updatePassword(req, res) {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid password reset data." });
  }

  const { token, password } = parsed.data;
  if (!token) {
    return res.status(400).json({ message: "Token inválido ou ausente." });
  }

  const entry = resetStore.get(token);

  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) resetStore.delete(token);
    return res.status(400).json({ message: "Token inválido ou ausente." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: entry.userId },
    data: { passwordHash },
  });

  resetStore.delete(token);
  clearAuthCookie(res);

  return res.json({ message: "Password updated successfully." });
}
