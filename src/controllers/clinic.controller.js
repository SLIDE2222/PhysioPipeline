import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const clinicProfileSchema = z.object({
  clinicName: z.string().min(2).max(160).optional().nullable(),
  address: z.string().min(2).max(200).optional().nullable(),
  city: z.string().min(2).max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
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
    address: clean(parsed.data.address),
    city: clean(parsed.data.city),
    phone: clean(parsed.data.phone),
    whatsapp: clean(parsed.data.whatsapp),
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
