import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const clinicProfileSchema = z.object({
  clinicName: z.string().min(2).max(160).optional().nullable(),
  responsibleName: z.string().min(2).max(160).optional().nullable(),
  address: z.string().min(2).max(200).optional().nullable(),
  city: z.string().min(2).max(120).optional().nullable(),
  neighborhood: z.string().min(2).max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  services: z.string().max(500).optional().nullable(),
  logoUrl: z.string().optional().or(z.literal("")).nullable(),
  description: z.string().max(2000).optional().nullable(),
});

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

function getClinicOnlyMessage() {
  return "Esta area e exclusiva para contas de clinica.";
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

async function findCurrentUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      accountType: true,
      clinicProfile: true,
    },
  });
}

function isClinicAccount(user) {
  return normalizeAccountType(user?.accountType) === ACCOUNT_TYPES.CLINIC;
}

export async function getMyClinicProfile(req, res) {
  const user = await findCurrentUser(req.user.userId);

  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }

  if (!isClinicAccount(user)) {
    return res.status(403).json({ message: getClinicOnlyMessage() });
  }

  return res.json({
    clinicProfile:
      user.clinicProfile || {
        clinicName: user.name || "",
        phone: user.phone || "",
      },
  });
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
      clinics.flatMap((clinic) =>
        String(clinic.services || "")
          .split(/[,\n/|]/)
          .map((item) => item.trim())
      )
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
  const specialty = String(req.query.specialty || req.query.especialidade || "").trim();
  const city = String(req.query.city || req.query.cidade || "").trim();
  const neighborhood = String(req.query.neighborhood || req.query.bairro || "").trim();

  const clinics = await prisma.clinicProfile.findMany({
    where: {
      clinicName: { not: null },
      city: city ? { contains: city, mode: "insensitive" } : undefined,
      neighborhood: neighborhood ? { contains: neighborhood, mode: "insensitive" } : undefined,
      OR: specialty
        ? [
            { services: { contains: specialty, mode: "insensitive" } },
            { description: { contains: specialty, mode: "insensitive" } },
            { clinicName: { contains: specialty, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ clinics });
}

export async function upsertMyClinicProfile(req, res) {
  const parsed = clinicProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados da clinica invalidos.",
      errors: parsed.error.flatten(),
    });
  }

  const user = await findCurrentUser(req.user.userId);

  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }

  if (!isClinicAccount(user)) {
    return res.status(403).json({ message: getClinicOnlyMessage() });
  }

  const data = {
    clinicName: clean(parsed.data.clinicName),
    responsibleName: clean(parsed.data.responsibleName),
    address: clean(parsed.data.address),
    city: clean(parsed.data.city),
    neighborhood: clean(parsed.data.neighborhood),
    phone: clean(parsed.data.phone),
    whatsapp: clean(parsed.data.whatsapp),
    services: clean(parsed.data.services),
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

  return res.json({ clinicProfile });
}
