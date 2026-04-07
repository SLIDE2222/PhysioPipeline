import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { mailConfig, sendMailOrThrow } from "../lib/mail.js";

const router = Router();
const prisma = new PrismaClient();

const CLAIM_REVIEW_EMAIL =
  process.env.CLAIM_REVIEW_EMAIL || process.env.SMTP_USER || "physiopipelinefisio@gmail.com";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeFilename(filename) {
  return String(filename || "diploma.pdf")
    .replace(/[^\w.\-() ]/g, "_")
    .trim();
}

router.post("/request", async (req, res) => {
  try {
    const {
      profileId,
      email,
      consentContact,
      fileName,
      fileMime,
      fileContentBase64
    } = req.body || {};

    if (!profileId) {
      return res.status(400).json({ message: "Profile id is required." });
    }

    const claimantEmail = normalizeEmail(email);
    if (!claimantEmail) {
      return res.status(400).json({ message: "E-mail is required." });
    }

    if (String(consentContact) !== "true" && consentContact !== true) {
      return res.status(400).json({ message: "Consent is required." });
    }

    if (!fileName || !fileContentBase64) {
      return res.status(400).json({ message: "Diploma PDF is required." });
    }

    const normalizedMime = String(fileMime || "application/pdf").toLowerCase();
    if (!normalizedMime.includes("pdf")) {
      return res.status(400).json({ message: "The diploma must be a PDF." });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: String(profileId) }
    });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    if (profile.isClaimed) {
      return res.status(400).json({
        message: "This profile has already been claimed."
      });
    }

    const attachmentName = sanitizeFilename(fileName);
    const base64Body = String(fileContentBase64 || "").replace(/^data:.*;base64,/, "").trim();

    await sendMailOrThrow({
      from: mailConfig.user,
      sender: mailConfig.user,
      to: CLAIM_REVIEW_EMAIL,
      replyTo: claimantEmail,
      subject: `Novo pedido de claim - ${profile.name}`,
      text: [
        "Novo pedido de claim recebido.",
        "",
        `Perfil: ${profile.name}`,
        `ID do perfil: ${profile.id}`,
        `Especialidade: ${profile.specialty || "-"}`,
        `Cidade: ${profile.city || "-"}`,
        `Bairro: ${profile.neighborhood || "-"}`,
        `E-mail informado: ${claimantEmail}`,
        "Consentimento de contato: sim",
        "",
        `Anexo: ${attachmentName}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Novo pedido de claim recebido</h2>
          <p><strong>Perfil:</strong> ${profile.name}</p>
          <p><strong>ID do perfil:</strong> ${profile.id}</p>
          <p><strong>Especialidade:</strong> ${profile.specialty || "-"}</p>
          <p><strong>Cidade:</strong> ${profile.city || "-"}</p>
          <p><strong>Bairro:</strong> ${profile.neighborhood || "-"}</p>
          <p><strong>E-mail informado:</strong> ${claimantEmail}</p>
          <p><strong>Consentimento de contato:</strong> sim</p>
          <p><strong>Anexo:</strong> ${attachmentName}</p>
        </div>
      `,
      attachments: [
        {
          filename: attachmentName,
          content: base64Body,
          encoding: "base64",
          contentType: "application/pdf",
          contentDisposition: "attachment",
        }
      ]
    });

    return res.status(201).json({
      message: `Pedido enviado para ${CLAIM_REVIEW_EMAIL}.`,
      emailSent: true,
    });
  } catch (error) {
    console.error("Claim request route error:", error);

    const detailedMessage = error?.response || error?.message || "Unknown mail error.";

    return res.status(500).json({
      message: `Failed to send claim e-mail: ${detailedMessage}`,
      error: detailedMessage
    });
  }
});

export default router;
