import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminUser } from "../lib/admin.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const PUBLIC_REVIEW_STATUSES = ["approved"];
const OWNER_REVIEW_STATUSES = ["pending_owner", "approved", "reported", "rejected"];
const OWNER_PENDING_REVIEW_STATUSES = ["pending_owner"];
const ADMIN_REVIEW_STATUSES = ["pending_admin", "reported", "approved", "rejected"];

const createReviewSchema = z.object({
  profileId: z.string().min(1, "Perfil invÃ¡lido."),
  authorName: z.string().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  authorEmail: z.string().email("E-mail invÃ¡lido.").optional().or(z.literal("")).nullable(),
  title: z.string().max(160, "TÃ­tulo muito longo.").optional().or(z.literal("")).nullable(),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Selecione uma nota de 1 a 5 estrelas.")
    .max(5, "Selecione uma nota de 1 a 5 estrelas."),
  body: z.string().min(3, "Escreva uma avaliaÃ§Ã£o mais completa.").max(4000, "AvaliaÃ§Ã£o muito longa."),
});

const reportReviewSchema = z.object({
  reason: z.string().min(5, "Descreva o motivo do reporte.").max(1000, "Motivo muito longo."),
});

function cleanOptionalString(value, maxLength = 4000) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeIncomingReviewPayload(payload) {
  return {
    profileId: String(payload?.profileId || payload?.professionalProfileId || "").trim(),
    authorName: payload?.authorName ?? payload?.reviewerName ?? "",
    authorEmail: payload?.authorEmail ?? payload?.reviewerEmail ?? "",
    title: payload?.title ?? "",
    rating: payload?.rating,
    body: payload?.body ?? payload?.comment ?? "",
  };
}

function normalizeReviewStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ADMIN_REVIEW_STATUSES.includes(normalized) ? normalized : null;
}

function isOwnedClaimedPhysioProfile(profile) {
  return Boolean(profile?.isClaimed && profile?.ownerUserId);
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
    rating: review.rating || null,
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

  if (review.status === "pending_admin") {
    return `AvaliaÃ§Ã£o aguardando revisÃ£o administrativa para ${profileName}.`;
  }

  if (review.status === "reported") {
    return `AvaliaÃ§Ã£o reportada em ${profileName}.`;
  }

  return `AvaliaÃ§Ã£o moderada em ${profileName}.`;
}

async function findCurrentUser(userId) {
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      accountType: true,
      name: true,
    },
  });
}

async function resolveOwnedPhysioProfile(userId) {
  const user = await findCurrentUser(userId);

  if (!user) {
    const error = new Error("UsuÃ¡rio nÃ£o encontrado.");
    error.status = 404;
    throw error;
  }

  if (normalizeAccountType(user.accountType) === ACCOUNT_TYPES.CLINIC) {
    const error = new Error("Apenas fisioterapeutas podem moderar reviews do prÃ³prio perfil.");
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

async function fetchReviewWithProfile(reviewId) {
  return prisma.profileReview.findUnique({
    where: { id: reviewId },
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
}

export async function listProfileReviews(req, res) {
  try {
    const profileId = String(req.params.profileId || req.params.id || "").trim();
    if (!profileId) {
      return res.status(400).json({ message: "Perfil invÃ¡lido." });
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
    return sendReviewControllerError(res, error, "Erro ao carregar reviews pÃºblicas.");
  }
}

export async function submitReview(req, res) {
  try {
    const parsed = createReviewSchema.safeParse(normalizeIncomingReviewPayload(req.body));

    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados da avaliaÃ§Ã£o invÃ¡lidos.",
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
      return res.status(404).json({ message: "Perfil nÃ£o encontrado." });
    }

    const status = isOwnedClaimedPhysioProfile(profile) ? "pending_owner" : "pending_admin";
    const review = await prisma.profileReview.create({
      data: {
        profileId: profile.id,
        authorName: cleanOptionalString(parsed.data.authorName, 120),
        authorEmail: cleanOptionalString(parsed.data.authorEmail, 255),
        title: cleanOptionalString(parsed.data.title, 160),
        rating: parsed.data.rating,
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
          status === "pending_owner"
            ? "Sua avaliaÃ§Ã£o foi enviada ao profissional e ficarÃ¡ visÃ­vel apÃ³s aprovaÃ§Ã£o."
            : "Sua avaliaÃ§Ã£o foi enviada para anÃ¡lise e ficarÃ¡ visÃ­vel apÃ³s aprovaÃ§Ã£o.",
      },
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao enviar avaliaÃ§Ã£o.");
  }
}

export async function listMyReviews(req, res) {
  try {
    const { profile } = await resolveOwnedPhysioProfile(req.user?.userId);
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
      reviews: reviews.map((review) =>
        serializeReview(review, {
          includePrivateFields: true,
          includeModerationFields: true,
        })
      ),
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao carregar reviews do proprietÃ¡rio.");
  }
}

export async function listMyPendingOwnerReviews(req, res) {
  try {
    const { profile } = await resolveOwnedPhysioProfile(req.user?.userId);
    const reviews = await prisma.profileReview.findMany({
      where: {
        profileId: profile.id,
        status: { in: OWNER_PENDING_REVIEW_STATUSES },
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
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao carregar reviews pendentes do proprietÃ¡rio.");
  }
}

export async function approveOwnReview(req, res) {
  try {
    const { user, profile } = await resolveOwnedPhysioProfile(req.user?.userId);
    const review = await fetchReviewWithProfile(req.params.reviewId);

    if (!review || review.profileId !== profile.id) {
      return res.status(404).json({ message: "Review nÃ£o encontrada para este perfil." });
    }

    if (review.status !== "pending_owner") {
      return res.status(409).json({ message: "Somente reviews pendentes podem ser aprovadas." });
    }

    const updated = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: "approved",
        moderatedAt: new Date(),
        moderatedByUserId: user.id,
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
      review: serializeReview(updated, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "AvaliaÃ§Ã£o aprovada com sucesso.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao aprovar review do proprietÃ¡rio.");
  }
}

export async function rejectOwnReview(req, res) {
  try {
    const { user, profile } = await resolveOwnedPhysioProfile(req.user?.userId);
    const review = await fetchReviewWithProfile(req.params.reviewId);

    if (!review || review.profileId !== profile.id) {
      return res.status(404).json({ message: "Review nÃ£o encontrada para este perfil." });
    }

    if (review.status !== "pending_owner") {
      return res.status(409).json({ message: "Somente reviews pendentes podem ser rejeitadas." });
    }

    const updated = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: "rejected",
        moderatedAt: new Date(),
        moderatedByUserId: user.id,
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
      review: serializeReview(updated, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "AvaliaÃ§Ã£o rejeitada com sucesso.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao rejeitar review do proprietÃ¡rio.");
  }
}

export async function reportReview(req, res) {
  try {
    const { user, profile } = await resolveOwnedPhysioProfile(req.user?.userId);
    const parsed = reportReviewSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados do reporte invÃ¡lidos.",
        errors: parsed.error.flatten(),
      });
    }

    const review = await fetchReviewWithProfile(req.params.reviewId);

    if (!review || review.profileId !== profile.id) {
      return res.status(404).json({ message: "Review nÃ£o encontrada para este perfil." });
    }

    const currentStatus = String(review.status || "").trim().toLowerCase();
    if (!["approved", "reported"].includes(currentStatus)) {
      return res.status(409).json({
        message: "Somente reviews publicadas podem ser reportadas.",
      });
    }

    const updated = await prisma.profileReview.update({
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
      review: serializeReview(updated, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "Review reportada para anÃ¡lise administrativa.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao reportar review.");
  }
}

export async function listAdminReviews(req, res) {
  try {
    await requireAdminUser(req.user?.userId);
    const requestedStatus = normalizeReviewStatus(req.query?.status) || "pending_admin";
    const reviews = await prisma.profileReview.findMany({
      where: {
        status: requestedStatus,
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
      summary: reviews.map((review) => ({
        id: review.id,
        text: buildReviewQueueSummary(review),
      })),
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao carregar fila administrativa de reviews.");
  }
}

export async function approveReview(req, res) {
  try {
    const adminUser = await requireAdminUser(req.user?.userId);
    const review = await fetchReviewWithProfile(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review nÃ£o encontrada." });
    }

    if (!["pending_admin", "reported"].includes(String(review.status || "").trim().toLowerCase())) {
      return res.status(409).json({
        message: "Somente reviews pendentes da administraÃ§Ã£o ou reportadas podem ser aprovadas.",
      });
    }

    const updated = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: "approved",
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
      review: serializeReview(updated, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "Review aprovada e publicada com sucesso.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao aprovar review.");
  }
}

export async function keepPublishedReview(req, res) {
  try {
    const adminUser = await requireAdminUser(req.user?.userId);
    const review = await fetchReviewWithProfile(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review nÃ£o encontrada." });
    }

    if (String(review.status || "").trim().toLowerCase() !== "reported") {
      return res.status(409).json({
        message: "Somente reviews reportadas podem ser mantidas como publicadas.",
      });
    }

    const updated = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: "approved",
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
      review: serializeReview(updated, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "Review mantida como publicada.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao manter review publicada.");
  }
}

export async function rejectReview(req, res) {
  try {
    const adminUser = await requireAdminUser(req.user?.userId);
    const review = await fetchReviewWithProfile(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review nÃ£o encontrada." });
    }

    if (!ADMIN_REVIEW_STATUSES.includes(String(review.status || "").trim().toLowerCase())) {
      return res.status(409).json({
        message: "Somente reviews moderÃ¡veis podem ser rejeitadas.",
      });
    }

    const updated = await prisma.profileReview.update({
      where: { id: review.id },
      data: {
        status: "rejected",
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
      review: serializeReview(updated, {
        includePrivateFields: true,
        includeModerationFields: true,
      }),
      message: "Review removida com sucesso.",
    });
  } catch (error) {
    return sendReviewControllerError(res, error, "Erro ao rejeitar review.");
  }
}