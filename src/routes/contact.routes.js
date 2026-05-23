import { Router } from "express";
import { mailConfig, sendMailOrThrow } from "../lib/mail.js";

const router = Router();

const CONTACT_EMAIL =
  process.env.CONTACT_EMAIL || "physiopipelinefisio@gmail.com";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      message,
      website,
    } = req.body || {};

    if (cleanText(website, 200)) {
      return res.status(400).json({ message: "Mensagem bloqueada por validação anti-spam." });
    }

    const senderName = cleanText(name, 160);
    const senderEmail = normalizeEmail(email);
    const contactSubject = cleanText(subject, 180);
    const contactMessage = cleanText(message, 4000);

    if (!senderName || !senderEmail || !contactSubject || contactMessage.length < 10) {
      return res.status(400).json({ message: "Preencha nome, e-mail, assunto e mensagem." });
    }

    await sendMailOrThrow({
      from: mailConfig.from || mailConfig.user,
      sender: mailConfig.user,
      to: CONTACT_EMAIL,
      replyTo: senderEmail,
      subject: `Contato PhysioPipeline - ${contactSubject}`,
      text: [
        "Nova mensagem recebida pelo site.",
        "",
        `Nome: ${senderName}`,
        `E-mail: ${senderEmail}`,
        `Assunto: ${contactSubject}`,
        "",
        contactMessage,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Nova mensagem recebida pelo site</h2>
          <p><strong>Nome:</strong> ${escapeHtml(senderName)}</p>
          <p><strong>E-mail:</strong> ${escapeHtml(senderEmail)}</p>
          <p><strong>Assunto:</strong> ${escapeHtml(contactSubject)}</p>
          <p>${escapeHtml(contactMessage).replace(/\n/g, "<br>")}</p>
        </div>
      `,
    });

    return res.status(201).json({
      message: `Mensagem enviada para ${CONTACT_EMAIL}.`,
      emailSent: true,
    });
  } catch (error) {
    console.error("Contact route error:", error);
    return res.status(500).json({
      message: error.message || "Não foi possível enviar a mensagem.",
    });
  }
});

export default router;
