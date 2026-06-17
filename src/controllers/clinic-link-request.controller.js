import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const createClinicLinkRequestSchema = z.object({
  clinicProfileId: z.string().min(1).optional().nullable(),
  clinicId: z.string().min(1).optional().nullable(),
  physioProfileId: z.string().min(1).optional().nullable(),
  requesterUserId: z.string().min(1).optional().nullable(),
  message: z.string().max(600).optional().nullable(),
}).refine(
  (data) => Boolean(data.clinicProfileId || data.clinicId),
  {
    message: "Informe a clínica da solicitação.",
    path: ["clinicProfileId"],
  }
);

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

function isClinicAccount(user) {
  return normalizeAccountType(user?.accountType) === ACCOUNT_TYPES.CLINIC;
}

function getPhysioOnlyMessage() {
  return "Esta área é exclusiva para fisioterapeutas.";
}

function decorateClinicSummary(clinic) {
  if (!clinic) return null;

  return {
    id: clinic.id,
    clinicName: clinic.clinicName,
    city: clinic.city,
    neighborhood: clinic.neighborhood,
    logoUrl: clinic.logoUrl,
    userId: clinic.userId ?? null,
  };
}

function decorateClinicLinkRequest(link) {
  if (!link) return null;

  return {
    id: link.id,
    physiotherapistProfileId: link.profileId,
    clinicProfileId: link.clinicId,
    requesterUserId: link.profile?.ownerUserId || null,
    status: link.status,
    message: link.message,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    acceptedAt: link.acceptedAt,
    rejectedAt: link.rejectedAt,
    unlinkedAt: link.unlinkedAt,
    readByClinic: link.readByClinic,
    readByPhysio: link.readByPhysio,
    clinic: decorateClinicSummary(link.clinic),
    profile: link.profile
      ? {
          id: link.profile.id,
          name: link.profile.name,
        }
      : null,
  };
}

async function findCurrentUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, accountType: true },
  });
}

async function resolveOwnedProfile(userId, userEmail) {
  const byOwner = await prisma.profile.findFirst({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
  });

  if (byOwner) return byOwner;

  return prisma.profile.findFirst({
    where: {
      publicEmail: { equals: userEmail, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function resolveOwnedProfileOrThrow(userId) {
  const user = await findCurrentUser(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  if (isClinicAccount(user)) {
    const error = new Error(getPhysioOnlyMessage());
    error.status = 403;
    throw error;
  }

  const profile = await resolveOwnedProfile(user.id, user.email);

  if (!profile) {
    const error = new Error("Nenhum perfil está vinculado a esta conta.");
    error.status = 404;
    throw error;
  }

  return { user, profile };
}

function sendControllerError(res, error, fallbackMessage = "Erro ao processar solicitação de vínculo.") {
  const status = error?.status || 500;
  if (status >= 500) console.error(fallbackMessage, error);

  return res.status(status).json({
    error: error?.message || fallbackMessage,
    message: error?.message || fallbackMessage,
  });
}

export async function createClinicLinkRequest(req, res) {
  try {
    const parsed = createClinicLinkRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Dados da solicitação inválidos.",
        message: "Dados da solicitação inválidos.",
        errors: parsed.error.flatten(),
      });
    }

    const { user, profile: ownedProfile } = await resolveOwnedProfileOrThrow(req.user.userId);
    const requestedClinicId = parsed.data.clinicProfileId || parsed.data.clinicId;
    const requestedPhysioProfileId = clean(parsed.data.physioProfileId);
    const profile = requestedPhysioProfileId
      ? await prisma.profile.findUnique({ where: { id: requestedPhysioProfileId } })
      : ownedProfile;

    if (!profile || profile.ownerUserId !== user.id) {
      return res.status(403).json({
        error: "Você precisa usar um perfil de fisioterapeuta vinculado à sua conta.",
        message: "Você precisa usar um perfil de fisioterapeuta vinculado à sua conta.",
      });
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { id: requestedClinicId },
    });

    if (!clinic) {
      return res.status(404).json({
        error: "Clínica não encontrada.",
        message: "Clínica não encontrada.",
      });
    }

    if (!clinic.userId) {
      return res.status(403).json({
        error: "Esta clínica ainda não possui uma conta responsável para receber solicitações.",
        message: "Esta clínica ainda não possui uma conta responsável para receber solicitações.",
      });
    }

    if (clinic.userId === user.id) {
      return res.status(403).json({
        error: "Você não pode solicitar vínculo com a sua própria clínica.",
        message: "Você não pode solicitar vínculo com a sua própria clínica.",
      });
    }

    const existing = await prisma.clinicPhysiotherapistLink.findUnique({
      where: {
        clinicId_profileId: {
          clinicId: clinic.id,
          profileId: profile.id,
        },
      },
      include: { clinic: true, profile: true },
    });

    if (existing && ["PENDING", "ACCEPTED"].includes(existing.status)) {
      const message = existing.status === "PENDING"
        ? "Você já solicitou vínculo com esta clínica."
        : "Vínculo ativo com esta clínica.";

      return res.status(409).json({
        error: message,
        message,
        link: decorateClinicLinkRequest(existing),
      });
    }

    const link = existing
      ? await prisma.clinicPhysiotherapistLink.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            message: clean(parsed.data.message),
            readByClinic: false,
            readByPhysio: true,
            acceptedAt: null,
            rejectedAt: null,
            unlinkedAt: null,
          },
          include: { clinic: true, profile: true },
        })
      : await prisma.clinicPhysiotherapistLink.create({
          data: {
            clinicId: clinic.id,
            profileId: profile.id,
            message: clean(parsed.data.message),
            readByClinic: false,
            readByPhysio: true,
          },
          include: { clinic: true, profile: true },
        });

    return res.status(201).json({
      message: "Vínculo solicitado com sucesso, caso aceito ou negado será notificado",
      link: decorateClinicLinkRequest(link),
    });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao enviar solicitação de vínculo com a clínica.");
  }
}

export async function listMyClinicLinkRequests(req, res) {
  try {
    const { profile } = await resolveOwnedProfileOrThrow(req.user.userId);
    const links = await prisma.clinicPhysiotherapistLink.findMany({
      where: { profileId: profile.id },
      include: { clinic: true, profile: true },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ links: links.map(decorateClinicLinkRequest) });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao carregar solicitações de vínculo com clínicas.");
  }
}
