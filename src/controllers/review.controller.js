import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminUser } from "../lib/admin.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const PUBLIC_REVIEW_STATUSES = ["published", "reported"];
const OWNER_REVIEW_STATUSES = ["pending", "published", "reported", "rejected"];
const ADMIN_REVIEW_STATUSES = ["pending", "reported", "published", "rejected"];

const createReviewSchema = z.object({
  profileId: z.string().min(1, "Perfil inválido."),
  authorName: z.string().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  authorEmail: z.string().email("E-mail inválido.").optional().or(z.literal("")).nullable(),
  title: z.string().max(160, "Título muito longo.").optional().or(z.literal("")).nullable(),
  body: z.string().min(10, "Escreva uma avaliação mais completa.").max(4000, "Avaliação muito longa."),
});

const reportReviewSchema = z.object({
  reason: z.string().min(5, "Descreva o motivo do reporte.").max(1000, "Motivo muito longo."),
});

function cleanOptionalString(value, maxLength = 4000) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeReviewStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ADMIN_REVIEW_STATUSES.includes(normalized) ? normalized : null;
}

function isOwnedPhysioProfile(profile) {
  // Review moderation depends on ownership at the exact submission moment.
  // Once a real physiotherapist account owns the profile, new reviews skip
  // the admin queue and publish immediately.
  return Boolean(profile?.ownerUserId);
}

function serializeReview(review, options = {}) {
  if (!review) return null;

  const includePrivateFields = Boolean(options.includePrivateFields);
  const includeModerationFields = Boolean(options.includeModerationFields);
  const profile = review.profile || null;

  return {
    id: review.id,
    profileId: review.profileId,
    authorName: review.authorName,
    title: review.title || null,
    body: review.body,
    status: review.status,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    reportReason: includeModerationFields ? review.reportReason || null : null,
    reportedAt: includeModerationFields ? review.reportedAt || null : null,
    moderatedAt: includeModerationFields ? review.moderatedAt || null : null,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          city: profile.city,
          neighborhood: profile.neighborhood,
          specialty: profile.specialty,
          photoUrl: profile.photoUrl,
          isClaimed: profile.isClaimed,
          ownerUserId: profile.ownerUserId,
        }
      : null,
    authorEmail: includePrivateFields ? review.authorEmail || null : null,
  };
}

function buildReviewQueueSummary(review) {
  const profileName = review?.profile?.name || "Perfil";
  if (review.status === "pending") {
    return `Avaliação aguardando aprovação para ${profileName}.`;
  }
  if (review.status === "reported") {
    return `Avaliação reportada em ${profileName}.`;
  }
  return `Avaliação moderada em ${profileName}.`;
}

async function findCurrentUser(userId) {
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      accountType: true,
    },
  });
}

async function resolveOwnedPhysioProfile(userId) {
  const user = await findCurrentUser(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  if (normalizeAccountType(user.accountType) === ACCOUNT_TYPES.CLINIC) {
    const error = new Error("Apenas fisioterapeutas podem moderar reviews do próprio perfil.");
    error.status = 403;
    throw error;
  }

  const profile =
    (await prisma.profile.findFirst({
      where: { ownerUserId: user.id },
      orderBy: { createdAt: "desc" },
    })) ||
    (await prisma.profile.findFirst({
      where: {
        publicEmail: {
          equals: user.email,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
    }));

  if (!profile) {
    const error = new Error("Nenhum perfil vinculado foi encontrado.");
    error.status = 404;
    throw error;
  }

  return { user, profile };
}

function sendReviewControllerError(res, error, fallbackMessage = "Erro ao processar reviews.") {
  const status = error?.status || 500;
  if (status >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(status).json({
    error: error?.message || fallbackMessage,
    message: error?.message || fallbackMessage,
  });
}

export async function listProfileReviews(req, res) {
  try {
    const profileId = String(req.params.profileId || "").trim();
    if (!profileId) {
      return res.status(400).json({ message: "Perfil inválido." });
    }

    const reviews = await prisma.profileReview.findMany({
      where: {
        profileId,
        status: { in: PUBLIC_REVIEW_STATUSES },
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      reviews: reviews.map((review) => serializeReview(review)),
      visibleStatuses: PUBLIC_REVIEW_STATUSES,
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao carregar reviews públicas.");
  }
}

export async function submitReview(req, res) {
  try {
    const parsed = createReviewSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados da review inválidos.",
        errors: parsed.error.flatten(),
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: parsed.data.profileId },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        isClaimed: true,
        city: true,
        neighborhood: true,
        specialty: true,
        photoUrl: true,
      },
    });

    if (!profile) {
      return res.status(404).json({ message: "Perfil não encontrado." });
    }

    const status = isOwnedPhysioProfile(profile) ? "published" : "pending";
    const review = await prisma.profileReview.create({
      data: {
        profileId: profile.id,
        authorName: cleanOptionalString(parsed.data.authorName, 120),
        authorEmail: cleanOptionalString(parsed.data.authorEmail, 255),
        title: cleanOptionalString(parsed.data.title, 160),
        body: cleanOptionalString(parsed.data.body, 4000),
        status,
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
    });

    return res.status(201).json({
      review: serializeReview(review),
      moderation: {
        status,
        message:
          status === "published"
            ? "Avaliação publicada com sucesso."
            : "Avaliação enviada para aprovação da equipe.",
      },
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao enviar avaliação.");
  }
}

export async function listMyReviews(req, res) {
  try {
    const { profile } = await resolveOwnedPhysioProfile(req.user.userId);
    const reviews = await prisma.profileReview.findMany({
      where: {
        profileId: profile.id,
        status: { in: OWNER_REVIEW_STATUSES },
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      profileId: profile.id,
      reviews: reviews.map((review) =>
        serializeReview(review, {
          includePrivateFields: true,
          includeModerationFields: true,
        })
      ),
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao carregar suas reviews.");
  }
}

export async function reportReview(req, res) {
  try {
    const parsed = reportReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Motivo do reporte inválido.",
        errors: parsed.error.flatten(),
      });
    }

    const { profile, user } = await resolveOwnedPhysioProfile(req.user.userId);
    const review = await prisma.profileReview.findUnique({
      where: { id: req.params.reviewId },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
    });

    if (!review || review.profileId !== profile.id) {
      return res.status(404).json({ message: "Review não encontrada para este perfil." });
    }

    if (!["published", "reported"].includes(review.status)) {
      return res.status(409).json({
        message: "Somente reviews publicadas podem ser reportadas pelo proprietário.",
      });
    }

    const updatedReview = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: "reported",
        reportReason: cleanOptionalString(parsed.data.reason, 1000),
        reportedAt: new Date(),
        reportedByUserId: user.id,
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
    });

    return res.json({
      review: serializeReview(updatedReview, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "Review reportada para análise administrativa.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao reportar review.");
  }
}

export async function listAdminReviews(req, res) {
  try {
    await requireAdminUser(req.user.userId);
    const requestedStatus = normalizeReviewStatus(req.query.status);
    const statuses = requestedStatus ? [requestedStatus] : ["pending", "reported"];

    const reviews = await prisma.profileReview.findMany({
      where: {
        status: { in: statuses },
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      reviews: reviews.map((review) =>
        serializeReview(review, {
          includePrivateFields: true,
          includeModerationFields: true,
        })
      ),
      summary: reviews.map(buildReviewQueueSummary),
      statusFilter: statuses,
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao carregar fila de reviews.");
  }
}

async function moderateReview(req, res, nextStatus) {
  try {
    const adminUser = await requireAdminUser(req.user.userId);
    const review = await prisma.profileReview.findUnique({
      where: { id: req.params.reviewId },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ message: "Review não encontrada." });
    }

    if (nextStatus === "published" && !["pending", "reported"].includes(review.status)) {
      return res.status(409).json({
        message: "Somente reviews pendentes ou reportadas podem ser publicadas.",
      });
    }

    if (nextStatus === "rejected" && review.status === "rejected") {
      return res.status(409).json({
        message: "Esta review já foi removida.",
      });
    }

    const updatedReview = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: nextStatus,
        moderatedAt: new Date(),
        moderatedByUserId: adminUser.id,
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            city: true,
            neighborhood: true,
            specialty: true,
            photoUrl: true,
            isClaimed: true,
            ownerUserId: true,
          },
        },
      },
    });

    return res.json({
      review: serializeReview(updatedReview, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message:
        nextStatus === "published"
          ? "Review mantida/publicada com sucesso."
          : "Review removida com sucesso.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao moderar review.");
  }
}

export function approveReview(req, res) {
  return moderateReview(req, res, "published");
}

export function keepPublishedReview(req, res) {
  return moderateReview(req, res, "published");
}

export function rejectReview(req, res) {
  return moderateReview(req, res, "rejected");
}
