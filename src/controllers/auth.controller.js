
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { mailConfig, sendMailOrThrow } from "../lib/mail.js";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildClientUrl(req) {
  const explicitClientUrl = normalizeBaseUrl(process.env.CLIENT_URL);
  if (explicitClientUrl) return explicitClientUrl;

  const publicAppUrl = normalizeBaseUrl(process.env.PUBLIC_APP_URL);
  if (publicAppUrl) return publicAppUrl;

  const originHeader = normalizeBaseUrl(req.headers.origin);
  if (originHeader) return originHeader;

  const refererHeader = String(req.headers.referer || "").trim();
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      return normalizeBaseUrl(refererUrl.origin);
    } catch (_) {
      // ignore invalid referer
    }
  }

  return "http://localhost:5500";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}



export async function forgotPassword(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // Always return a generic success message to avoid exposing whether an account exists.
    if (!user) {
      return res.json({
        message: "Se o e-mail existir, o link de recuperação foi enviado.",
      });
    }

    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    const clientUrl = buildClientUrl(req);
    const resetLink = `${clientUrl}/update-password.html?token=${encodeURIComponent(token)}`;

    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    await sendMailOrThrow({
      from: mailConfig.from || mailConfig.user,
      sender: mailConfig.user,
      to: email,
      replyTo: mailConfig.user,
      subject: "Recuperação de senha - PhysioPipeline",
      text: [
        "Recuperação de senha",
        "",
        "Recebemos uma solicitação para redefinir sua senha no PhysioPipeline.",
        `Abra este link para criar uma nova senha: ${resetLink}`,
        "",
        "Este link expira em 30 minutos.",
        "Se você não solicitou isso, ignore este e-mail.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>Recuperação de senha</h2>
          <p>Recebemos uma solicitação para redefinir sua senha no <strong>PhysioPipeline</strong>.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">
              Criar nova senha
            </a>
          </p>
          <p>Este link expira em <strong>30 minutos</strong>.</p>
          <p>Se você não solicitou isso, ignore este e-mail.</p>
        </div>
      `,
    });

    return res.json({
      message: "Se o e-mail existir, o link de recuperação foi enviado.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      message: err.message || "Não foi possível enviar o link de recuperação.",
    });
  }
}



export async function updatePassword(req, res) {
  try {
    const token = String(req.body?.token || req.body?.accessToken || "").trim();
    const password = String(req.body?.password || "");

    if (!token || !password) {
      return res.status(400).json({ message: "Token e nova senha são obrigatórios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ message: "Token inválido ou expirado." });
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
      return res.status(400).json({ message: "Token expirado. Solicite um novo link." });
    }

    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true },
    });

    if (!user) {
      await prisma.passwordResetToken.deleteMany({ where: { email: resetToken.email } });
      return res.status(400).json({ message: "Token inválido ou expirado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { email: resetToken.email },
      }),
    ]);

    return res.json({ message: "Senha atualizada com sucesso." });
  } catch (err) {
    console.error("Update password error:", err);
    return res.status(500).json({
      message: err.message || "Não foi possível atualizar a senha.",
    });
  }
}
