import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const createProfileSchema = z.object({
  name: z.string().min(2),
  specialty: z.string().min(2),
  secondarySpecialty: z.string().optional().nullable(),
  tertiarySpecialty: z.string().optional().nullable(),
  city: z.string().min(2),
  neighborhood: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  instagram: z.string().url().optional().or(z.literal("")).nullable(),
  linkedin: z.string().url().optional().or(z.literal("")).nullable(),
  photoUrl: z.string().optional().or(z.literal("")).nullable(),
  publicEmail: z.string().email().optional().or(z.literal("")).nullable(),
  attendance: z.string().optional().nullable(),
});

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

function cleanOption(value, maxLength = 160) {
  const option = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  if (!option || option === "-" || /^n[aï¿½]o informado$/i.test(option)) return null;

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

function isClinicAccount(user) {
  return normalizeAccountType(user?.accountType) === ACCOUNT_TYPES.CLINIC;
}

// Clinics use a separate private dashboard/data model so public physio search
// continues to read only from the existing Profile table.
function getPhysioOnlyMessage() {
  return "Esta conta é do tipo clínica. Use o dashboard da clínica para editar os dados privados da conta.";
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

async function findCurrentUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, accountType: true },
  });
}

export async function listProfileOptions(_req, res) {
  try {
    const profiles = await prisma.profile.findMany({
      select: {
        city: true,
        neighborhood: true,
        specialty: true,
        secondarySpecialty: true,
        tertiarySpecialty: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 3000,
    });

    const cities = uniqueSortedOptions(profiles.map((profile) => profile.city));
    const neighborhoods = uniqueSortedOptions(profiles.map((profile) => profile.neighborhood));
    const neighborhoodsByCity = {};

    profiles.forEach((profile) => {
      const city = cleanOption(profile.city);
      const neighborhood = cleanOption(profile.neighborhood);
      if (!city || !neighborhood) return;

      if (!neighborhoodsByCity[city]) neighborhoodsByCity[city] = [];
      neighborhoodsByCity[city].push(neighborhood);
    });

    Object.keys(neighborhoodsByCity).forEach((city) => {
      neighborhoodsByCity[city] = uniqueSortedOptions(neighborhoodsByCity[city]);
    });

    const specialties = uniqueSortedOptions(
      profiles.flatMap((profile) => [
        profile.specialty,
        profile.secondarySpecialty,
        profile.tertiarySpecialty,
      ])
    );

    res.set("Cache-Control", "public, max-age=300");

    return res.json({
      cities,
      neighborhoods,
      neighborhoodsByCity,
      specialties,
    });
  } catch (error) {
    console.error("Profile options route error:", error);
    res.set("Cache-Control", "no-store");

    return res.json({
      cities: [],
      neighborhoods: [],
      neighborhoodsByCity: {},
      specialties: [],
    });
  }
}

export async function listProfiles(req, res) {
  const { specialty, city, neighborhood } = req.query;

  const profiles = await prisma.profile.findMany({
    where: {
      OR: specialty
        ? [
            { specialty: { contains: String(specialty), mode: "insensitive" } },
            { secondarySpecialty: { contains: String(specialty), mode: "insensitive" } },
            { tertiarySpecialty: { contains: String(specialty), mode: "insensitive" } },
          ]
        : undefined,
      city: city ? { contains: String(city), mode: "insensitive" } : undefined,
      neighborhood: neighborhood
        ? { contains: String(neighborhood), mode: "insensitive" }
        : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ profiles });
}

export async function getProfile(req, res) {
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) {
    return res.status(404).json({ message: "Perfil não encontrado." });
  }
  return res.json({ profile });
}

export async function getMyProfile(req, res) {
  const user = await findCurrentUser(req.user.userId);

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  if (isClinicAccount(user)) {
    return res.status(403).json({ message: getPhysioOnlyMessage() });
  }

  const profile = await resolveOwnedProfile(user.id, user.email);

  if (!profile) {
    return res.status(404).json({ message: "Nenhum perfil esta vinculado a esta conta." });
  }

  return res.json({ profile });
}

export async function createProfile(req, res) {
  const parsed = createProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados do perfil invalidos.",
      errors: parsed.error.flatten(),
    });
  }

  const user = await findCurrentUser(req.user.userId);

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  if (isClinicAccount(user)) {
    return res.status(403).json({ message: getPhysioOnlyMessage() });
  }

  const existing = await prisma.profile.findFirst({
    where: { ownerUserId: req.user.userId },
  });

  if (existing) {
    return res.status(409).json({ message: "Esta conta ja possui um perfil." });
  }

  const profile = await prisma.profile.create({
    data: {
      name: parsed.data.name,
      specialty: parsed.data.specialty,
      secondarySpecialty: clean(parsed.data.secondarySpecialty),
      tertiarySpecialty: clean(parsed.data.tertiarySpecialty),
      city: parsed.data.city,
      neighborhood: clean(parsed.data.neighborhood),
      phone: clean(parsed.data.phone),
      bio: clean(parsed.data.bio),
      instagram: clean(parsed.data.instagram),
      linkedin: clean(parsed.data.linkedin),
      photoUrl: clean(parsed.data.photoUrl),
      publicEmail: clean(parsed.data.publicEmail) || user.email || null,
      attendance: clean(parsed.data.attendance),
      ownerUserId: req.user.userId,
      isClaimed: true,
    },
  });

  if (parsed.data.phone !== undefined) {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { phone: clean(parsed.data.phone) },
    });
  }

  return res.status(201).json({ profile });
}

export async function updateMyProfile(req, res) {
  const parsed = createProfileSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Atualização de perfil inválida.",
      errors: parsed.error.flatten(),
    });
  }

  const user = await findCurrentUser(req.user.userId);

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  if (isClinicAccount(user)) {
    return res.status(403).json({ message: getPhysioOnlyMessage() });
  }

  const profile = await resolveOwnedProfile(user.id, user.email);

  if (!profile) {
    return res.status(404).json({ message: "Nenhum perfil esta vinculado a esta conta." });
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.specialty !== undefined ? { specialty: parsed.data.specialty } : {}),
      ...(parsed.data.secondarySpecialty !== undefined
        ? { secondarySpecialty: clean(parsed.data.secondarySpecialty) }
        : {}),
      ...(parsed.data.tertiarySpecialty !== undefined
        ? { tertiarySpecialty: clean(parsed.data.tertiarySpecialty) }
        : {}),
      ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
      ...(parsed.data.neighborhood !== undefined
        ? { neighborhood: clean(parsed.data.neighborhood) }
        : {}),
      ...(parsed.data.phone !== undefined ? { phone: clean(parsed.data.phone) } : {}),
      ...(parsed.data.bio !== undefined ? { bio: clean(parsed.data.bio) } : {}),
      ...(parsed.data.instagram !== undefined ? { instagram: clean(parsed.data.instagram) } : {}),
      ...(parsed.data.linkedin !== undefined ? { linkedin: clean(parsed.data.linkedin) } : {}),
      ...(parsed.data.photoUrl !== undefined ? { photoUrl: clean(parsed.data.photoUrl) } : {}),
      ...(parsed.data.publicEmail !== undefined
        ? { publicEmail: clean(parsed.data.publicEmail) }
        : {}),
      ...(parsed.data.attendance !== undefined
        ? { attendance: clean(parsed.data.attendance) }
        : {}),
      ownerUserId: user.id,
      isClaimed: true,
    },
  });

  if (parsed.data.phone !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: clean(parsed.data.phone) },
    });
  }

  return res.json({ profile: updated });
}



