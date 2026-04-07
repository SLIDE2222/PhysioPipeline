import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const rawPort = Number(process.env.SMTP_PORT || 465);
const rawPass = String(process.env.SMTP_PASS || "");
const normalizedPass = rawPass.replace(/\s+/g, "").trim();
const normalizedUser = String(process.env.SMTP_USER || "").trim();
const normalizedHost = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
const normalizedFrom = String(process.env.MAIL_FROM || normalizedUser).trim();
const normalizedClientUrl = String(process.env.CLIENT_URL || "http://localhost:5500").trim();

export const mailConfig = {
  host: normalizedHost,
  port: rawPort,
  secure: rawPort === 465,
  user: normalizedUser,
  pass: normalizedPass,
  from: normalizedFrom,
  clientUrl: normalizedClientUrl,
};

export const isMailConfigured = Boolean(
  mailConfig.host && mailConfig.user && mailConfig.pass && mailConfig.from
);

export const transporter = isMailConfigured
  ? nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  : null;

let verifyStarted = false;
let verifyPromise = null;

export async function verifyTransporter() {
  if (!isMailConfigured || !transporter) {
    const missing = [];
    if (!mailConfig.user) missing.push("SMTP_USER");
    if (!mailConfig.pass) missing.push("SMTP_PASS");
    if (!mailConfig.from) missing.push("MAIL_FROM");

    return {
      ok: false,
      reason: "not_configured",
      error: new Error(`Missing mail config: ${missing.join(", ") || "unknown"}`),
    };
  }

  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    console.error("SMTP verify failed:", error.message || error);
    return { ok: false, reason: "verify_failed", error };
  }
}

export async function warmupMailTransport() {
  if (!transporter || verifyStarted) return verifyPromise;
  verifyStarted = true;

  verifyPromise = verifyTransporter()
    .then((result) => {
      if (result?.ok) {
        console.log("SMTP transporter verified successfully.");
      } else {
        console.error("SMTP warmup skipped/failed:", result?.error?.message || result?.reason || "unknown");
      }
      return result;
    })
    .catch((error) => {
      console.error("SMTP warmup crashed:", error.message || error);
      return { ok: false, reason: "warmup_crash", error };
    });

  return verifyPromise;
}

export async function sendMailOrThrow(mailOptions) {
  const verify = await verifyTransporter();
  if (!verify.ok) {
    throw verify.error || new Error("Mail transporter is not configured.");
  }

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("SMTP sendMail failed:", error);
    throw error;
  }
}

export async function sendClaimVerificationEmail({ to, token, profileName }) {
  const verifyUrl = `${mailConfig.clientUrl}/claim-profile.html?token=${encodeURIComponent(token)}`;

  const info = await sendMailOrThrow({
    from: mailConfig.user,
    sender: mailConfig.user,
    to,
    replyTo: mailConfig.user,
    subject: `Confirm your claim for ${profileName}`,
    text: [
      "Claim your Physio Pipeline profile",
      "",
      `We received a request to claim the profile for ${profileName}.`,
      `Open this link to confirm: ${verifyUrl}`,
      "",
      "If you did not request this, ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Claim your Physio Pipeline profile</h2>
        <p>We received a request to claim the profile for <strong>${profileName}</strong>.</p>
        <p>Click the button below to confirm:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">Confirm claim</a></p>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `,
  });

  return {
    previewUrl: verifyUrl,
    delivery: "sent",
    messageId: info.messageId || null,
  };
}

void warmupMailTransport();
