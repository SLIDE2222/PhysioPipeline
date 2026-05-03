import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const rawPort = Number(process.env.SMTP_PORT || 587);
const rawPass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();
const rawUser = String(process.env.SMTP_USER || "").trim();
const rawHost = String(process.env.SMTP_HOST || "smtp-relay.brevo.com").trim();
const rawFrom = String(process.env.MAIL_FROM || rawUser).trim();
const rawClientUrl = String(process.env.CLIENT_URL || "http://localhost:5500").trim();

function withTimeout(promise, timeoutMs, label = "SMTP timeout") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label)), timeoutMs)
    ),
  ]);
}

export const mailConfig = {
  host: rawHost,
  port: rawPort,
  secure: false,
  user: rawUser,
  pass: rawPass,
  from: rawFrom,
  clientUrl: rawClientUrl,
  timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 8000),
};

export const transporter =
  mailConfig.user && mailConfig.pass
    ? nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: false,
        auth: {
          user: mailConfig.user,
          pass: mailConfig.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: mailConfig.timeoutMs,
        greetingTimeout: mailConfig.timeoutMs,
        socketTimeout: mailConfig.timeoutMs,
      })
    : null;

export async function sendMailOrThrow(mailOptions) {
  if (!transporter) {
    throw new Error("Mail transporter not configured.");
  }

  try {
    return await withTimeout(
      transporter.sendMail(mailOptions),
      mailConfig.timeoutMs,
      "SMTP send timeout"
    );
  } catch (error) {
    console.error("SMTP sendMail failed:", error.message || error);
    throw error;
  }
}
