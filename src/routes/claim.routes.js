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

function sanitizeFilename(filename, fallback = "arquivo.pdf") {
  return String(filename || fallback)
    .replace(/[^\w.\-() ]/g, "_")
    .trim();
}

function normalizeBoolean(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

router.post("/request", async (req, res) => {
  try {
    const {
      profileId,
      email,
      consentContact,
      fileName,
      fileMime,
      fileContentBase64,
      website
    } = req.body || {};

    if (String(website || "").trim()) {
      return res.status(400).json({ message: "Pedido bloqueado por validacao anti-spam." });
    }

    if (!profileId) {
      return res.status(400).json({ message: "Perfil e obrigatorio." });
    }

    const claimantEmail = normalizeEmail(email);
    if (!claimantEmail) {
      return res.status(400).json({ message: "E-mail e obrigatorio." });
    }

    if (!normalizeBoolean(consentContact)) {
      return res.status(400).json({ message: "Autorizacao de contato e obrigatoria." });
    }

    if (!fileName || !fileContentBase64) {
      return res.status(400).json({ message: "Diploma em PDF e obrigatorio." });
    }

    const normalizedMime = String(fileMime || "application/pdf").toLowerCase();
    if (!normalizedMime.includes("pdf")) {
      return res.status(400).json({ message: "O diploma precisa estar em PDF." });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: String(profileId) }
    });

    if (!profile) {
      return res.status(404).json({ message: "Perfil não encontrado." });
    }

    if (profile.isClaimed) {
      return res.status(400).json({
        message: "Esse perfil ja foi reivindicado."
      });
    }

    const attachmentName = sanitizeFilename(fileName, "diploma.pdf");
    const base64Body = String(fileContentBase64 || "").replace(/^data:.*;base64,/, "").trim();

    await sendMailOrThrow({
      from: mailConfig.from || mailConfig.user,
      sender: mailConfig.user,
      to: CLAIM_REVIEW_EMAIL,
      replyTo: claimantEmail,
      subject: `Novo pedido de reivindicacao - ${profile.name}`,
      text: [
        "Novo pedido de reivindicacao recebido.",
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
          <h2>Novo pedido de reivindicacao recebido</h2>
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
    console.error("Erro na rota de reivindicacao:", error);

    const detailedMessage = error?.response || error?.message || "Erro de e-mail desconhecido.";

    return res.status(500).json({
      message: `Nao foi possivel enviar o e-mail de reivindicacao: ${detailedMessage}`,
      error: detailedMessage
    });
  }
});

router.post("/clinic-request", async (req, res) => {
  try {
    const {
      clinicProfileId,
      clinicName,
      cnpj,
      responsibleName,
      responsibleEmail,
      whatsapp,
      roleOrRelation,
      authorizationConfirmed,
      fileName,
      fileMime,
      fileContentBase64,
      website,
    } = req.body || {};

    if (String(website || "").trim()) {
      return res.status(400).json({ message: "Pedido bloqueado por validacao anti-spam." });
    }

    if (!clinicProfileId) {
      return res.status(400).json({ message: "Perfil da clínica e obrigatorio." });
    }

    const normalizedEmail = normalizeEmail(responsibleEmail);
    const normalizedClinicName = String(clinicName || "").trim();
    const normalizedResponsibleName = String(responsibleName || "").trim();
    const normalizedWhatsapp = String(whatsapp || "").trim();
    const normalizedRoleOrRelation = String(roleOrRelation || "").trim();
    const normalizedCnpj = String(cnpj || "").trim();

    if (!normalizedClinicName) {
      return res.status(400).json({ message: "Nome da clínica e obrigatorio." });
    }

    if (!normalizedCnpj) {
      return res.status(400).json({ message: "CNPJ e obrigatorio." });
    }

    if (!normalizedResponsibleName) {
      return res.status(400).json({ message: "Nome do responsavel e obrigatorio." });
    }

    if (!normalizedEmail) {
      return res.status(400).json({ message: "E-mail do responsavel e obrigatorio." });
    }

    if (!normalizedWhatsapp) {
      return res.status(400).json({ message: "WhatsApp e obrigatorio." });
    }

    if (!normalizedRoleOrRelation) {
      return res.status(400).json({ message: "Cargo ou vínculo com a clínica e obrigatorio." });
    }

    if (!normalizeBoolean(authorizationConfirmed)) {
      return res.status(400).json({ message: "Voce precisa confirmar que tem autorizacao para solicitar acesso a este perfil." });
    }

    if (!fileName || !fileContentBase64) {
      return res.status(400).json({ message: "Envie um comprovante do CNPJ ou do vínculo com a clínica." });
    }

    const clinicProfile = await prisma.clinicProfile.findUnique({
      where: { id: String(clinicProfileId) },
    });

    if (!clinicProfile) {
      return res.status(404).json({ message: "Perfil de clínica não encontrado." });
    }

    if (clinicProfile.userId) {
      return res.status(400).json({ message: "Essa clínica ja esta vinculada a uma conta." });
    }

    const attachmentName = sanitizeFilename(fileName, "comprovação-clínica.pdf");
    const attachmentMime = String(fileMime || "application/pdf").trim() || "application/pdf";
    const base64Body = String(fileContentBase64 || "").replace(/^data:.*;base64,/, "").trim();

    const clinicClaim = await prisma.clinicClaimRequest.create({
      data: {
        clinicProfileId: clinicProfile.id,
        clinicName: normalizedClinicName,
        cnpj: normalizedCnpj,
        responsibleName: normalizedResponsibleName,
        responsibleEmail: normalizedEmail,
        whatsapp: normalizedWhatsapp,
        roleOrRelation: normalizedRoleOrRelation,
        authorizationConfirmed: true,
        proofFileName: attachmentName,
        proofFileMime: attachmentMime,
      },
    });

    await sendMailOrThrow({
      from: mailConfig.from || mailConfig.user,
      sender: mailConfig.user,
      to: CLAIM_REVIEW_EMAIL,
      replyTo: normalizedEmail,
      subject: "Nova solicitacao de reivindicacao de clínica - PhysioPipeline",
      text: [
        "Nova solicitacao de reivindicacao de clínica recebida.",
        "",
        `Claim ID: ${clinicClaim.id}`,
        `Clinic profile id: ${clinicProfile.id}`,
        `Nome da clínica: ${normalizedClinicName}`,
        `CNPJ: ${normalizedCnpj}`,
        `Nome do responsavel: ${normalizedResponsibleName}`,
        `E-mail: ${normalizedEmail}`,
        `WhatsApp: ${normalizedWhatsapp}`,
        `Cargo/vínculo: ${normalizedRoleOrRelation}`,
        "Confirmacao de autorizacao: sim",
        `Anexo: ${attachmentName}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Nova solicitacao de reivindicacao de clínica</h2>
          <p><strong>Claim ID:</strong> ${clinicClaim.id}</p>
          <p><strong>Clinic profile id:</strong> ${clinicProfile.id}</p>
          <p><strong>Nome da clínica:</strong> ${normalizedClinicName}</p>
          <p><strong>CNPJ:</strong> ${normalizedCnpj}</p>
          <p><strong>Nome do responsavel:</strong> ${normalizedResponsibleName}</p>
          <p><strong>E-mail:</strong> ${normalizedEmail}</p>
          <p><strong>WhatsApp:</strong> ${normalizedWhatsapp}</p>
          <p><strong>Cargo/vínculo:</strong> ${normalizedRoleOrRelation}</p>
          <p><strong>Confirmacao de autorizacao:</strong> sim</p>
          <p><strong>Anexo:</strong> ${attachmentName}</p>
        </div>
      `,
      attachments: [
        {
          filename: attachmentName,
          content: base64Body,
          encoding: "base64",
          contentType: attachmentMime,
          contentDisposition: "attachment",
        }
      ]
    });

    return res.status(201).json({
      message: "Solicitacao de reivindicacao da clínica enviada com sucesso.",
      claimRequestId: clinicClaim.id,
      emailSent: true,
    });
  } catch (error) {
    console.error("Erro na rota de reivindicacao de clínica:", error);

    const detailedMessage = error?.response || error?.message || "Erro desconhecido ao enviar o e-mail.";

    return res.status(500).json({
      message: `Nao foi possivel enviar a reivindicacao da clínica: ${detailedMessage}`,
      error: detailedMessage,
    });
  }
});

export default router;


