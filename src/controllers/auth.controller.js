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

function formatClinicLinkNotification(link, accountType) {
  const clinicName = link.clinic?.clinicName || "A clinica";
  const profileName = link.profile?.name || "fisioterapeuta";
  const clinicLocation = [link.clinic?.city, link.clinic?.neighborhood].filter(Boolean).join(" - ");

  if (accountType === ACCOUNT_TYPES.CLINIC) {
    const statusText = link.status === "ACCEPTED"
      ? `${profileName} aceitou o vinculo com sua clinica.`
      : link.status === "REJECTED"
        ? `${profileName} recusou o vinculo com sua clinica.`
        : link.status === "UNLINKED"
          ? `${profileName} foi desvinculado da sua clinica.`
          : `${profileName} solicitou vinculo com esta clinica. Perfil ${link.profileId} - Clinica ${link.clinicId}.`;

    return {
      id: link.id,
      type: "clinic_physio_link",
      status: link.status,
      unread: !link.readByClinic,
      title: "Solicitacao de vinculo com clinica",
      message: statusText,
      linkId: link.id,
      profileId: link.profileId,
      profileName,
      clinicId: link.clinicId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }

  return {
    id: link.id,
    type: "clinic_physio_link_request",
    status: link.status,
    unread: !link.readByPhysio,
    title: "Solicitacao de vinculo",
    message: `A clinica ${clinicName} quer vincular seu perfil a equipe dela.`,
    linkId: link.id,
    clinicId: link.clinicId,
    clinicName,
    clinicLocation,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
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
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const accountType = normalizeAccountType(user.accountType);
    let links = [];

    if (accountType === ACCOUNT_TYPES.CLINIC && user.clinicProfile?.id) {
      links = await prisma.clinicPhysiotherapistLink.findMany({
        where: {
          clinicId: user.clinicProfile.id,
          status: { in: ["PENDING", "ACCEPTED", "REJECTED", "UNLINKED"] },
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
            status: { in: ["PENDING", "ACCEPTED"] },
          },
          include: { clinic: true, profile: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        });
      }
    }

    const notifications = links.map((link) => formatClinicLinkNotification(link, accountType));

    return res.json({
      notifications,
      unreadCount: notifications.filter((item) => item.unread).length,
    });
  } catch (error) {
    console.error("Notifications route error:", error);
    return res.status(500).json({ message: error.message || "Não foi possível carregar notificações." });
  }
}

export async function markNotificationRead(req, res) {
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
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const link = await prisma.clinicPhysiotherapistLink.findUnique({
      where: { id: req.params.id },
      include: { clinic: true, profile: true },
    });

    if (!link) {
      return res.status(404).json({ message: "Notificação não encontrada." });
    }

    const accountType = normalizeAccountType(user.accountType);
    const ownedProfile = user.profiles?.[0] || await prisma.profile.findFirst({
      where: { ownerUserId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const canReadAsClinic = accountType === ACCOUNT_TYPES.CLINIC && user.clinicProfile?.id === link.clinicId;
    const canReadAsPhysio = ownedProfile?.id === link.profileId;

    if (!canReadAsClinic && !canReadAsPhysio) {
      return res.status(403).json({ message: "Você não pode alterar esta notificação." });
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
    return res.status(500).json({ message: error.message || "Não foi possível atualizar a notificação." });
  }
}








