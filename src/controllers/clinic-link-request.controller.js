import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const createClinicLinkRequestSchema = z.object({
  clinicProfileId: z.string().min(1).optional().nullable(),
  clinicId: z.string().min(1).optional().nullable(),
  physioProfileId: z.string().min(1).optional().nullable(),
  physioId: z.string().min(1).optional().nullable(),
  requesterUserId: z.string().min(1).optional().nullable(),
  message: z.string().max(600).optional().nullable(),
}).refine(
  (data) => Boolean(data.clinicProfileId || data.clinicId),
  {
    message: "Informe a clinica da solicitacao.",
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
  return "Esta area e exclusiva para fisioterapeutas.";
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
          city: link.profile.city || null,
          neighborhood: link.profile.neighborhood || null,
          specialty: link.profile.specialty || null,
          bio: link.profile.bio || null,
          avatarUrl: link.profile.photoUrl || null,
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
    const error = new Error("Usuario nao encontrado.");
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
    const error = new Error("Nenhum perfil esta vinculado a esta conta.");
    error.status = 404;
    throw error;
  }

  return { user, profile };
}

function sendControllerError(res, error, fallbackMessage = "Erro ao processar solicitacao de vinculo.") {
  const status = error?.status || 500;
  if (status >= 500) console.error(fallbackMessage, error);

  return res.status(status).json({
    error: error?.message || fallbackMessage,
    message: error?.message || fallbackMessage,
  });
}

function buildClinicOwnerNotification({ clinic, profile, link }) {
  return {
    recipientUserId: clinic.userId || null,
    type: "clinic_link_request",
    title: "Nova solicitação de vínculo",
    message: `${profile.name} quer vincular seu perfil à equipe desta clínica.`,
    icon: "physiopipeline-p",
    relatedClinicId: clinic.id,
    relatedPhysioId: profile.id,
    relatedRequestId: link.id,
    status: "unread",
    linkId: link.id,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

function isActiveLinkRequestStatus(status) {
  return status === "PENDING" || status === "ACCEPTED";
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
    const requestedPhysioProfileId = clean(parsed.data.physioProfileId || parsed.data.physioId);
    const profile = requestedPhysioProfileId
      ? await prisma.profile.findUnique({ where: { id: requestedPhysioProfileId } })
      : ownedProfile;

    console.log("clinicId:", requestedClinicId);
    console.log("physioProfileId:", profile?.id || null);
    console.log("requesterUserId:", req.user.userId);

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

    console.log("clinic owner user id:", clinic.userId || null);

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

    if (existing && isActiveLinkRequestStatus(existing.status)) {
      const message = existing.status === "PENDING"
        ? "Você já solicitou vínculo com esta clínica."
        : "Vínculo ativo com esta clínica.";

      return res.status(409).json({
        success: false,
        error: message,
        message,
        notification: buildClinicOwnerNotification({
          clinic: existing.clinic,
          profile: existing.profile,
          link: existing,
        }),
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

    const notification = buildClinicOwnerNotification({
      clinic,
      profile,
      link,
    });

    console.log("notification recipientUserId:", notification.recipientUserId);
    console.log("notification created:", notification);

    return res.status(201).json({
      success: true,
      message: "Vínculo solicitado com sucesso, caso aceito ou negado será notificado",
      notification,
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

export async function getClinicLinkRequest(req, res) {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        clinicProfile: true,
      },
    });

    if (!currentUser) {
      return res.status(404).json({
        error: "Usuario nao encontrado.",
        message: "Usuario nao encontrado.",
      });
    }

    const link = await prisma.clinicPhysiotherapistLink.findUnique({
      where: { id: req.params.id },
      include: {
        clinic: true,
        profile: true,
      },
    });

    if (!link) {
      return res.status(404).json({
        error: "Solicitação de vínculo não encontrada.",
        message: "Solicitação de vínculo não encontrada.",
      });
    }

    const isRecipientClinicOwner = Boolean(
      currentUser.clinicProfile?.id && link.clinicId === currentUser.clinicProfile.id
    );
    const isRequesterPhysioOwner = link.profile?.ownerUserId === currentUser.id;

    if (!isRecipientClinicOwner && !isRequesterPhysioOwner) {
      return res.status(403).json({
        error: "Você não pode visualizar esta solicitação.",
        message: "Você não pode visualizar esta solicitação.",
      });
    }

    return res.json({
      id: link.id,
      status: link.status,
      clinicId: link.clinicId,
      physioProfileId: link.profileId,
      requesterUserId: link.profile?.ownerUserId || null,
      physio: link.profile
        ? {
            id: link.profile.id,
            name: link.profile.name,
            city: link.profile.city || null,
            neighborhood: link.profile.neighborhood || null,
            specialty: link.profile.specialty || null,
            bio: link.profile.bio || null,
            avatarUrl: link.profile.photoUrl || null,
          }
        : null,
    });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao carregar detalhes da solicitação de vínculo.");
  }
}

export async function getPendingClinicLinkRequestForClinic(req, res) {
  try {
    const { clinicProfile } = await resolveOwnedClinicOrThrow(req.user.userId);
    const link = await prisma.clinicPhysiotherapistLink.findFirst({
      where: {
        clinicId: clinicProfile.id,
        status: "PENDING",
      },
      include: {
        clinic: true,
        profile: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!link) {
      return res.status(404).json({
        error: "Nenhuma solicitação pendente encontrada para esta clínica.",
        message: "Nenhuma solicitação pendente encontrada para esta clínica.",
      });
    }

    return res.json({
      id: link.id,
      status: link.status,
      clinicId: link.clinicId,
      physioProfileId: link.profileId,
      requesterUserId: link.profile?.ownerUserId || null,
      physio: link.profile
        ? {
            id: link.profile.id,
            name: link.profile.name,
            city: link.profile.city || null,
            neighborhood: link.profile.neighborhood || null,
            specialty: link.profile.specialty || null,
            bio: link.profile.bio || null,
            avatarUrl: link.profile.photoUrl || null,
          }
        : null,
    });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao carregar a solicitação pendente da clínica.");
  }
}

async function resolveOwnedClinicOrThrow(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      clinicProfile: true,
    },
  });

  if (!user) {
    const error = new Error("Usuario nao encontrado.");
    error.status = 404;
    throw error;
  }

  if (!isClinicAccount(user)) {
    const error = new Error("Esta area e exclusiva para clinicas.");
    error.status = 403;
    throw error;
  }

  if (!user.clinicProfile?.id) {
    const error = new Error("Nenhuma clinica esta vinculada a esta conta.");
    error.status = 404;
    throw error;
  }

  return { user, clinicProfile: user.clinicProfile };
}

async function updateClinicOwnedLink(req, res, nextStatus) {
  try {
    const { user, clinicProfile } = await resolveOwnedClinicOrThrow(req.user.userId);
    const link = await prisma.clinicPhysiotherapistLink.findUnique({
      where: { id: req.params.linkId },
      include: {
        clinic: true,
        profile: true,
      },
    });

    if (!link || link.clinicId !== clinicProfile.id) {
      return res.status(404).json({
        error: "Solicitação de vínculo não encontrada.",
        message: "Solicitação de vínculo não encontrada.",
      });
    }

    const updated = await prisma.clinicPhysiotherapistLink.update({
      where: { id: link.id },
      data: {
        status: nextStatus,
        readByClinic: true,
        readByPhysio: false,
        acceptedAt: nextStatus === "ACCEPTED" ? new Date() : null,
        rejectedAt: nextStatus === "REJECTED" ? new Date() : null,
        unlinkedAt: nextStatus === "UNLINKED" ? new Date() : null,
      },
      include: {
        clinic: true,
        profile: true,
      },
    });

    return res.json({
      success: true,
      requesterUserId: updated.profile?.ownerUserId || null,
      recipientUserId: user.id,
      link: decorateClinicLinkRequest(updated),
    });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao atualizar solicitacao de vinculo da clinica.");
  }
}

export function acceptClinicLinkRequest(req, res) {
  return updateClinicOwnedLink(req, res, "ACCEPTED");
}

export function rejectClinicLinkRequest(req, res) {
  return updateClinicOwnedLink(req, res, "REJECTED");
}
