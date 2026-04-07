import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const createProfileSchema = z.object({
  name: z.string().min(2),
  specialty: z.string().min(2),
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

export async function listProfiles(req, res) {
  const { specialty, city, neighborhood } = req.query;

  const profiles = await prisma.profile.findMany({
    where: {
      specialty: specialty ? { contains: String(specialty), mode: "insensitive" } : undefined,
      city: city ? { contains: String(city), mode: "insensitive" } : undefined,
      neighborhood: neighborhood ? { contains: String(neighborhood), mode: "insensitive" } : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ profiles });
}

export async function getProfile(req, res) {
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) {
    return res.status(404).json({ message: "Profile not found." });
  }
  return res.json({ profile });
}

export async function getMyProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const profile = await resolveOwnedProfile(user.id, user.email);

  if (!profile) {
    return res.status(404).json({ message: "No profile is linked to this account." });
  }

  return res.json({ profile });
}

export async function createProfile(req, res) {
  const parsed = createProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid profile data.", errors: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true },
  });

  const existing = await prisma.profile.findFirst({
    where: { ownerUserId: req.user.userId },
  });

  if (existing) {
    return res.status(409).json({ message: "This account already has a profile." });
  }

  const profile = await prisma.profile.create({
    data: {
      name: parsed.data.name,
      specialty: parsed.data.specialty,
      city: parsed.data.city,
      neighborhood: clean(parsed.data.neighborhood),
      phone: clean(parsed.data.phone),
      bio: clean(parsed.data.bio),
      instagram: clean(parsed.data.instagram),
      linkedin: clean(parsed.data.linkedin),
      photoUrl: clean(parsed.data.photoUrl),
      publicEmail: clean(parsed.data.publicEmail) || user?.email || null,
      attendance: clean(parsed.data.attendance),
      ownerUserId: req.user.userId,
      isClaimed: true,
    },
  });

  return res.status(201).json({ profile });
}

export async function updateMyProfile(req, res) {
  const parsed = createProfileSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid profile update.", errors: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const profile = await resolveOwnedProfile(user.id, user.email);

  if (!profile) {
    return res.status(404).json({ message: "No profile is linked to this account." });
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.specialty !== undefined ? { specialty: parsed.data.specialty } : {}),
      ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
      ...(parsed.data.neighborhood !== undefined ? { neighborhood: clean(parsed.data.neighborhood) } : {}),
      ...(parsed.data.phone !== undefined ? { phone: clean(parsed.data.phone) } : {}),
      ...(parsed.data.bio !== undefined ? { bio: clean(parsed.data.bio) } : {}),
      ...(parsed.data.instagram !== undefined ? { instagram: clean(parsed.data.instagram) } : {}),
      ...(parsed.data.linkedin !== undefined ? { linkedin: clean(parsed.data.linkedin) } : {}),
      ...(parsed.data.photoUrl !== undefined ? { photoUrl: clean(parsed.data.photoUrl) } : {}),
      ...(parsed.data.publicEmail !== undefined ? { publicEmail: clean(parsed.data.publicEmail) } : {}),
      ...(parsed.data.attendance !== undefined ? { attendance: clean(parsed.data.attendance) } : {}),
      ownerUserId: user.id,
      isClaimed: true,
    },
  });

  return res.json({ profile: updated });
}
