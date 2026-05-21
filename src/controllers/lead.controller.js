import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const leadEventSchema = z.object({
  profileId: z.string().min(1),
  type: z.enum([
    "PROFILE_VIEW",
    "WHATSAPP_CLICK",
    "EMAIL_CLICK",
    "INSTAGRAM_CLICK",
    "LINKEDIN_CLICK",
  ]),
  source: z.string().max(80).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  specialty: z.string().max(160).optional().nullable(),
});

function clean(value) {
  if (value === "") return null;
  return value ?? null;
}

export async function createLeadEvent(req, res) {
  const parsed = leadEventSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados de performance inválidos.",
      errors: parsed.error.flatten(),
    });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: parsed.data.profileId },
    select: { id: true },
  });

  if (!profile) {
    return res.status(404).json({ message: "Perfil não encontrado." });
  }

  const leadEvent = await prisma.leadEvent.create({
    data: {
      profileId: parsed.data.profileId,
      type: parsed.data.type,
      source: clean(parsed.data.source),
      city: clean(parsed.data.city),
      specialty: clean(parsed.data.specialty),
    },
  });

  return res.status(201).json({ leadEvent });
}

export async function getMyLeadSummary(req, res) {
  const profile = await prisma.profile.findFirst({
    where: { ownerUserId: req.user.userId },
    select: { id: true },
  });

  if (!profile) {
    return res.status(404).json({ message: "Nenhum perfil está vinculado a esta conta." });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const events = await prisma.leadEvent.groupBy({
    by: ["type"],
    where: {
      profileId: profile.id,
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  const summary = {
    PROFILE_VIEW: 0,
    WHATSAPP_CLICK: 0,
    EMAIL_CLICK: 0,
    INSTAGRAM_CLICK: 0,
    LINKEDIN_CLICK: 0,
  };

  events.forEach((event) => {
    summary[event.type] = event._count._all;
  });

  return res.json({
    profileId: profile.id,
    periodDays: 30,
    summary,
  });
}

