import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendClaimVerificationEmail } from "../lib/mail.js";
import { ACCOUNT_TYPES, normalizeAccountType } from "../constants/account-types.js";

const requestClaimSchema = z.object({
  profileId: z.string().min(1),
});

export async function requestClaim(req, res) {
  const parsed = requestClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Pedido de reivindicacao invalido." });
  }

  const profile = await prisma.profile.findUnique({ where: { id: parsed.data.profileId } });
  if (!profile) {
    return res.status(404).json({ message: "Perfil não encontrado." });
  }

  if (profile.isClaimed) {
    return res.status(409).json({ message: "Esse perfil ja foi reivindicado." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  if (normalizeAccountType(user.accountType) !== ACCOUNT_TYPES.PHYSIO) {
    return res.status(403).json({
      message: "Somente contas de fisioterapeuta podem reivindicar perfis publicos.",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const claim = await prisma.claimRequest.create({
    data: {
      profileId: profile.id,
      userId: user.id,
      requestEmail: user.email,
      token,
      expiresAt,
    },
  });

  const mailResult = await sendClaimVerificationEmail({
    to: user.email,
    token,
    profileName: profile.name,
  });

  return res.status(201).json({
    message: "E-mail de reivindicacao enviado.",
    claimId: claim.id,
    previewUrl: mailResult.previewUrl || null,
  });
}

export async function verifyClaim(req, res) {
  const token = String(req.query.token || req.body?.token || "");
  if (!token) {
    return res.status(400).json({ message: "Token e obrigatorio." });
  }

  const claim = await prisma.claimRequest.findUnique({
    where: { token },
    include: { profile: true, user: true },
  });

  if (!claim) {
    return res.status(404).json({ message: "Reivindicacao nao encontrada." });
  }

  if (claim.status !== "PENDING") {
    return res.status(409).json({ message: `A reivindicacao ja esta com status ${claim.status.toLowerCase()}.` });
  }

  if (claim.expiresAt < new Date()) {
    await prisma.claimRequest.update({ where: { id: claim.id }, data: { status: "EXPIRED" } });
    return res.status(410).json({ message: "Link de reivindicacao expirado." });
  }

  if (claim.profile.isClaimed) {
    return res.status(409).json({ message: "Esse perfil ja foi reivindicado." });
  }

  await prisma.$transaction([
    prisma.profile.update({
      where: { id: claim.profileId },
      data: {
        isClaimed: true,
        ownerUserId: claim.userId,
      },
    }),
    prisma.user.update({
      where: { id: claim.userId },
      data: { emailVerified: true },
    }),
    prisma.claimRequest.update({ where: { id: claim.id }, data: { status: "APPROVED" } }),
  ]);

  return res.json({ message: "Reivindicacao de perfil confirmada com sucesso." });
}

