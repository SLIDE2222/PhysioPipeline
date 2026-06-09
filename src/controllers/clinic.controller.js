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

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

function getClinicOnlyMessage() {
  return "Esta Ãƒ¡rea Ãƒ© exclusiva para contas de clÃƒ­nica.";
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

function decorateClinicProfile(profile) {
  if (!profile) return profile;

  const servicesList = normalizeClinicServices(profile.services);
  const physioTeamList = normalizeClinicTeam(profile.physioTeam);

  return {
    ...profile,
    services: profile.services ?? null,
    servicesList,
    physioTeam: profile.physioTeam ?? null,
    physioTeamList,
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

export async function getClinic(req, res) {
  const clinicProfile = await prisma.clinicProfile.findUnique({
    where: { id: req.params.id },
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
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ clinics: clinics.map(decorateClinicProfile) });
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
        error: "Dados da clÃƒ­nica invÃƒ¡lidos.",
        message: "Dados da clÃƒ­nica invÃƒ¡lidos.",
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
      error: error?.message || "Erro ao salvar perfil da clÃƒ­nica.",
      message: error?.message || "Erro ao salvar perfil da clÃƒ­nica.",
      code: error?.code || undefined,
      meta: error?.meta || undefined,
    });
  }
}

