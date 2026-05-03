-- Password reset tokens table for custom password recovery
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key"
ON "PasswordResetToken"("token");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx"
ON "PasswordResetToken"("email");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
ON "PasswordResetToken"("expiresAt");
