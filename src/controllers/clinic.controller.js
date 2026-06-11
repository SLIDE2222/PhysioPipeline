import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const MAX_CLINIC_TEAM = 5;
const MAX_SERVICE_TAGS = 20;

const clinicTeamMemberSchema = z.object({
  name: z.string().min(2).max(160),
  specialty: z.string().min(2).max(120),
});

const clinicProfileSchema = z.object({
  clinicName: z.string().min(2).max(160).optional().nullable(),
  responsibleName: z.string().min(2).max(160).optional().nullable(),
  address: z.string().min(2).max(200).optional().nullable(),
  city: z.string().min(2).max(120).optional().nullable(),
  neighborhood: z.string().min(2).max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  services: z
    .union([z.string().max(1200), z.array(z.string().max(120)).max(MAX_SERVICE_TAGS)])
    .optional()
    .nullable(),
  physioTeam: z
    .union([z.string().max(4000), z.array(clinicTeamMemberSchema).max(MAX_CLINIC_TEAM)])
    .optional()
    .nullable(),
  logoUrl: z.string().optional().or(z.literal("")).nullable(),
  description: z.string().max(2000).optional().nullable(),
});

const linkRequestSchema = z.object({
  profileId: z.string().min(1),
  message: z.string().max(600).optional().nullable(),
});

const physioSearchSchema = z.object({
  query: z.string().max(120).optional().default(""),
  name: z.string().max(120).optional().default(""),
  city: z.string().max(120).optional().default(""),
  specialty: z.string().max(120).optional().default(""),
});

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

function getClinicOnlyMessage() {
  return "Esta área é exclusiva para contas de clínica.";
}

function cleanOption(value, maxLength = 160) {
  const option = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  if (!option || option === "-") return null;
  return option;
}

function normalizeOptionKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueSortedOptions(values) {
  const byKey = new Map();

  values.forEach((value) => {
    const option = cleanOption(value);
    if (!option) return;

    const key = normalizeOptionKey(option);
    if (!key || byKey.has(key)) return;
    byKey.set(key, option);
  });

  return Array.from(byKey.values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

function parseJsonArray(value) {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

// Clinic services are stored as a serialized list for backward compatibility.
// Older rows may still contain a plain string, so every read normalizes both shapes.
function normalizeClinicServices(value) {
  const rawValues = Array.isArray(value)
    ? value
    : parseJsonArray(value) || String(value || "").split(/[,\n/|]/);

  return uniqueSortedOptions(rawValues.map((item) => cleanOption(item, 120))).slice(
    0,
    MAX_SERVICE_TAGS
  );
}

function serializeClinicServices(value) {
  const services = normalizeClinicServices(value);
  return services.length ? JSON.stringify(services) : null;
}

function normalizeClinicTeam(value) {
  const rawValues = Array.isArray(value) ? value : parseJsonArray(value) || [];
  const normalized = [];

  rawValues.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const name = cleanOption(item.name, 160);
    const specialty = cleanOption(item.specialty, 120);
    if (!name || !specialty) return;

    const key = normalizeOptionKey(`${name}::${specialty}`);
    if (!key || normalized.some((member) => normalizeOptionKey(`${member.name}::${member.specialty}`) === key)) {
      return;
    }

    normalized.push({ name, specialty });
  });

  return normalized.slice(0, MAX_CLINIC_TEAM);
}

function serializeClinicTeam(value) {
  const team = normalizeClinicTeam(value);
  return team.length ? JSON.stringify(team) : null;
}

function getProfileSpecialties(profile) {
  return uniqueSortedOptions([
    profile?.specialty,
    profile?.secondarySpecialty,
    profile?.tertiarySpecialty,
  ]);
}

function decorateProfileSummary(profile) {
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    specialty: profile.specialty,
    secondarySpecialty: profile.secondarySpecialty,
    tertiarySpecialty: profile.tertiarySpecialty,
    specialties: getProfileSpecialties(profile),
    city: profile.city,
    neighborhood: profile.neighborhood,
    photoUrl: profile.photoUrl,
  };
}

function decorateClinicLink(link) {
  if (!link) return null;

  return {
    id: link.id,
    status: link.status,
    message: link.message,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    acceptedAt: link.acceptedAt,
    rejectedAt: link.rejectedAt,
    unlinkedAt: link.unlinkedAt,
    readByClinic: link.readByClinic,
    readByPhysio: link.readByPhysio,
    profile: decorateProfileSummary(link.profile),
  };
}

function decorateClinicProfile(profile) {
  if (!profile) return profile;

  const servicesList = normalizeClinicServices(profile.services);
  const physioTeamList = normalizeClinicTeam(profile.physioTeam);
  const linkedPhysiotherapists = Array.isArray(profile.physiotherapistLinks)
    ? profile.physiotherapistLinks
        .filter((link) => link.status === "ACCEPTED")
        .map(decorateClinicLink)
        .filter(Boolean)
    : [];

  return {
    ...profile,
    services: profile.services ?? null,
    servicesList,
    physioTeam: profile.physioTeam ?? null,
    physioTeamList,
    linkedPhysiotherapists,
    isClaimable: typeof profile.isClaimable === "boolean" ? profile.isClaimable : !profile.userId,
  };
}

async function findCurrentUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      accountType: true,
      clinicProfile: true,
    },
  });
}

function isClinicAccount(user) {
  return normalizeAccountType(user?.accountType) === ACCOUNT_TYPES.CLINIC;
}

async function getOwnedClinicProfile(userId) {
  const user = await findCurrentUser(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  if (!isClinicAccount(user)) {
    const error = new Error(getClinicOnlyMessage());
    error.status = 403;
    throw error;
  }

  const clinicProfile = user.clinicProfile || await prisma.clinicProfile.create({
    data: {
      userId: user.id,
      clinicName: user.name || user.email,
      responsibleName: user.name || null,
      phone: user.phone || null,
      whatsapp: user.phone || null,
      services: null,
      physioTeam: null,
    },
  });

  return { user, clinicProfile };
}

function sendControllerError(res, error, fallbackMessage = "Erro ao processar solicitação.") {
  const status = error?.status || 500;
  if (status >= 500) console.error(fallbackMessage, error);

  return res.status(status).json({
    error: error?.message || fallbackMessage,
    message: error?.message || fallbackMessage,
  });
}

export async function getClinic(req, res) {
  const clinicProfile = await prisma.clinicProfile.findUnique({
    where: { id: req.params.id },
    include: {
      physiotherapistLinks: {
        where: { status: "ACCEPTED" },
        include: { profile: true },
        orderBy: { acceptedAt: "desc" },
      },
    },
  });

  if (!clinicProfile) {
    return res.status(404).json({ message: "ClÃƒ­nica não encontrada." });
  }

  return res.json({ clinicProfile: decorateClinicProfile(clinicProfile) });
}

export async function getMyClinicProfile(req, res) {
  const user = await findCurrentUser(req.user.userId);

  if (!user) {
    return res.status(404).json({ error: "UsuÃƒ¡rio não encontrado.", message: "UsuÃƒ¡rio não encontrado." });
  }

  if (!isClinicAccount(user)) {
    return res.status(403).json({ error: getClinicOnlyMessage(), message: getClinicOnlyMessage() });
  }

  // Clinic accounts always need a persisted ClinicProfile linked to the
  // authenticated user id. If an older clinic user exists without one, create a
  // minimal profile now so the dashboard/profile lookup never falls through to
  // the physiotherapist-only "perfil não encontrado" state.
  const clinicProfile = user.clinicProfile || await prisma.clinicProfile.create({
    data: {
      userId: user.id,
      clinicName: user.name || user.email,
      responsibleName: user.name || null,
      phone: user.phone || null,
      whatsapp: user.phone || null,
      services: null,
      physioTeam: null,
    },
  });

  if (!user.clinicProfile) {
    console.info("Clinic profile auto-created from /clinics/me:", {
      userId: user.id,
      clinicProfileId: clinicProfile.id,
    });
  }

  return res.json({ clinicProfile: decorateClinicProfile(clinicProfile) });
}

export async function listClinicOptions(_req, res) {
  try {
    const clinics = await prisma.clinicProfile.findMany({
      select: {
        city: true,
        neighborhood: true,
        services: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 3000,
    });

    const cities = uniqueSortedOptions(clinics.map((clinic) => clinic.city));
    const neighborhoods = uniqueSortedOptions(clinics.map((clinic) => clinic.neighborhood));
    const neighborhoodsByCity = {};

    clinics.forEach((clinic) => {
      const city = cleanOption(clinic.city);
      const neighborhood = cleanOption(clinic.neighborhood);
      if (!city || !neighborhood) return;

      if (!neighborhoodsByCity[city]) neighborhoodsByCity[city] = [];
      neighborhoodsByCity[city].push(neighborhood);
    });

    Object.keys(neighborhoodsByCity).forEach((city) => {
      neighborhoodsByCity[city] = uniqueSortedOptions(neighborhoodsByCity[city]);
    });

    const specialties = uniqueSortedOptions(
      clinics.flatMap((clinic) => normalizeClinicServices(clinic.services))
    );

    return res.json({
      cities,
      neighborhoods,
      neighborhoodsByCity,
      specialties,
    });
  } catch (error) {
    console.error("Clinic options route error:", error);
    return res.json({
      cities: [],
      neighborhoods: [],
      neighborhoodsByCity: {},
      specialties: [],
    });
  }
}

export async function listClinics(req, res) {
  const query = String(
    req.query.query || req.query.specialty || req.query.especialidade || ""
  ).trim();
  const city = String(req.query.city || req.query.cidade || "").trim();
  const neighborhood = String(req.query.neighborhood || req.query.bairro || "").trim();

  const clinics = await prisma.clinicProfile.findMany({
    where: {
      clinicName: { not: null },
      city: city ? { contains: city, mode: "insensitive" } : undefined,
      neighborhood: neighborhood ? { contains: neighborhood, mode: "insensitive" } : undefined,
      OR: query
        ? [
            { services: { contains: query, mode: "insensitive" } },
            { physioTeam: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { clinicName: { contains: query, mode: "insensitive" } },
            { responsibleName: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { neighborhood: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      physiotherapistLinks: {
        where: { status: "ACCEPTED" },
        include: { profile: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ clinics: clinics.map(decorateClinicProfile) });
}

export async function searchPhysiotherapistsForClinic(req, res) {
  try {
    const { query, name, city, specialty } = physioSearchSchema.parse(req.query);
    const nameTerm = cleanOption(name || query, 120);
    const cityTerm = cleanOption(city, 120);
    const specialtyTerm = cleanOption(specialty || query, 120);
    const filters = [
      ...(nameTerm ? [{ name: { contains: nameTerm, mode: "insensitive" } }] : []),
      ...(cityTerm ? [{ city: { contains: cityTerm, mode: "insensitive" } }] : []),
      ...(specialtyTerm
        ? [
            { specialty: { contains: specialtyTerm, mode: "insensitive" } },
            { secondarySpecialty: { contains: specialtyTerm, mode: "insensitive" } },
            { tertiarySpecialty: { contains: specialtyTerm, mode: "insensitive" } },
          ]
        : []),
    ];

    const profiles = await prisma.profile.findMany({
      where: {
        ownerUserId: { not: null },
        ...(filters.length ? { OR: filters } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return res.json({ profiles: profiles.map(decorateProfileSummary) });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao buscar fisioterapeutas.");
  }
}

export async function listMyClinicPhysioLinks(req, res) {
  try {
    const { clinicProfile } = await getOwnedClinicProfile(req.user.userId);
    const links = await prisma.clinicPhysiotherapistLink.findMany({
      where: { clinicId: clinicProfile.id },
      include: { profile: true },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ links: links.map(decorateClinicLink) });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao carregar vínculos da clínica.");
  }
}

export async function requestClinicPhysioLink(req, res) {
  try {
    const parsed = linkRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Dados da solicitação inválidos.",
        message: "Dados da solicitação inválidos.",
        errors: parsed.error.flatten(),
      });
    }

    const { user, clinicProfile } = await getOwnedClinicProfile(req.user.userId);
    const profile = await prisma.profile.findUnique({ where: { id: parsed.data.profileId } });

    if (!profile) {
      return res.status(404).json({ error: "Fisioterapeuta não encontrado.", message: "Fisioterapeuta não encontrado." });
    }

    if (!profile.ownerUserId) {
      return res.status(403).json({
        error: "Este perfil ainda não pertence a um fisioterapeuta cadastrado.",
        message: "Este perfil ainda não pertence a um fisioterapeuta cadastrado.",
      });
    }

    if (!profile.ownerUserId) {
      return res.status(403).json({
        error: "Este perfil já pertence a um fisioterapeuta cadastrado.",
        message: "Este perfil já pertence a um fisioterapeuta cadastrado.",
      });
    }

    if (profile.ownerUserId === user.id) {
      return res.status(403).json({
        error: "Uma clínica não pode solicitar vínculo com um perfil do mesmo usuário.",
        message: "Uma clínica não pode solicitar vínculo com um perfil do mesmo usuário.",
      });
    }

    const manualCount = normalizeClinicTeam(clinicProfile.physioTeam).length;
    const acceptedCount = await prisma.clinicPhysiotherapistLink.count({
      where: { clinicId: clinicProfile.id, status: "ACCEPTED" },
    });

    if (manualCount + acceptedCount >= MAX_CLINIC_TEAM) {
      return res.status(400).json({
        error: "Limite de 5 fisioterapeutas atingido.",
        message: "Limite de 5 fisioterapeutas atingido.",
      });
    }

    const existing = await prisma.clinicPhysiotherapistLink.findUnique({
      where: {
        clinicId_profileId: {
          clinicId: clinicProfile.id,
          profileId: profile.id,
        },
      },
      include: { profile: true },
    });

    if (existing && ["PENDING", "ACCEPTED"].includes(existing.status)) {
      const message = existing.status === "PENDING"
        ? "Já existe uma solicitação pendente para este fisioterapeuta."
        : "Este fisioterapeuta já está vinculado à clínica.";
      return res.status(409).json({ error: message, message });
    }

    const link = existing
      ? await prisma.clinicPhysiotherapistLink.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            message: clean(parsed.data.message),
            readByClinic: true,
            readByPhysio: false,
            acceptedAt: null,
            rejectedAt: null,
            unlinkedAt: null,
          },
          include: { profile: true },
        })
      : await prisma.clinicPhysiotherapistLink.create({
          data: {
            clinicId: clinicProfile.id,
            profileId: profile.id,
            message: clean(parsed.data.message),
            readByClinic: true,
            readByPhysio: false,
          },
          include: { profile: true },
        });

    return res.status(201).json({ link: decorateClinicLink(link) });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao enviar solicitação de vínculo.");
  }
}

export async function unlinkClinicPhysioFromClinic(req, res) {
  try {
    const { clinicProfile } = await getOwnedClinicProfile(req.user.userId);
    const link = await prisma.clinicPhysiotherapistLink.findUnique({
      where: { id: req.params.linkId },
      include: { profile: true },
    });

    if (!link || link.clinicId !== clinicProfile.id) {
      return res.status(404).json({ error: "Vínculo não encontrado.", message: "Vínculo não encontrado." });
    }

    const updated = await prisma.clinicPhysiotherapistLink.update({
      where: { id: link.id },
      data: {
        status: "UNLINKED",
        readByClinic: true,
        readByPhysio: false,
        unlinkedAt: new Date(),
      },
      include: { profile: true },
    });

    return res.json({ link: decorateClinicLink(updated) });
  } catch (error) {
    return sendControllerError(res, error, "Erro ao desvincular fisioterapeuta.");
  }
}

export async function upsertMyClinicProfile(req, res) {
  console.info("Clinic profile upsert request:", {
    method: req.method,
    path: req.originalUrl,
    authUserId: req.user?.userId || null,
    bodyKeys: Object.keys(req.body || {}),
  });

  try {
    const parsed = clinicProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Dados da clínica inválidos.",
        message: "Dados da clínica inválidos.",
        errors: parsed.error.flatten(),
      });
    }

    const user = await findCurrentUser(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: "UsuÃƒ¡rio não encontrado.", message: "UsuÃƒ¡rio não encontrado." });
    }

    if (!isClinicAccount(user)) {
      return res.status(403).json({ error: getClinicOnlyMessage(), message: getClinicOnlyMessage() });
    }

    const data = {
      clinicName: clean(parsed.data.clinicName),
      responsibleName: clean(parsed.data.responsibleName),
      address: clean(parsed.data.address),
      city: clean(parsed.data.city),
      neighborhood: clean(parsed.data.neighborhood),
      phone: clean(parsed.data.phone),
      whatsapp: clean(parsed.data.whatsapp),
      services: serializeClinicServices(parsed.data.services),
      physioTeam: serializeClinicTeam(parsed.data.physioTeam),
      logoUrl: clean(parsed.data.logoUrl),
      description: clean(parsed.data.description),
    };

    const clinicProfile = user.clinicProfile
      ? await prisma.clinicProfile.update({
          where: { userId: user.id },
          data,
        })
      : await prisma.clinicProfile.create({
          data: {
            userId: user.id,
            ...data,
          },
        });

    if (parsed.data.phone !== undefined || parsed.data.clinicName !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(parsed.data.phone !== undefined ? { phone: clean(parsed.data.phone) } : {}),
          ...(parsed.data.clinicName !== undefined ? { name: clean(parsed.data.clinicName) } : {}),
        },
      });
    }

    console.info("Clinic profile upsert succeeded:", {
      userId: user.id,
      clinicProfileId: clinicProfile.id,
      method: req.method,
      path: req.originalUrl,
    });

    return res.json({ clinicProfile: decorateClinicProfile(clinicProfile) });
  } catch (error) {
    console.error("Clinic profile upsert failed:", {
      method: req.method,
      path: req.originalUrl,
      authUserId: req.user?.userId || null,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });

    return res.status(500).json({
      error: error?.message || "Erro ao salvar perfil da clínica.",
      message: error?.message || "Erro ao salvar perfil da clínica.",
      code: error?.code || undefined,
      meta: error?.meta || undefined,
    });
  }
}

