import { prisma } from "./prisma.js";

function parseAdminEmails() {
  return new Set(
    String(process.env.ADMIN_REVIEW_EMAILS || process.env.ADMIN_EMAILS || "")
      .split(/[,\s;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return false;
  return parseAdminEmails().has(normalizedEmail);
}

export async function getAdminUserById(userId) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    isAdmin: isAdminEmail(user.email),
  };
}

// Reviews moderation is admin-only on the backend. We intentionally resolve
// admin access from a configured email allowlist because the current schema
// has no dedicated admin role field yet.
export async function requireAdminUser(userId) {
  const user = await getAdminUserById(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  if (!user.isAdmin) {
    const error = new Error("Acesso restrito à administração.");
    error.status = 403;
    throw error;
  }

  return user;
}
