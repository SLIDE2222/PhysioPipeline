DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
    CREATE TYPE "AccountType" AS ENUM ('physio', 'clinic');
  END IF;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'physio';

UPDATE "User"
SET "accountType" = 'physio'
WHERE "accountType" IS NULL;

CREATE TABLE IF NOT EXISTS "ClinicProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clinicName" TEXT,
  "address" TEXT,
  "city" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "logoUrl" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClinicProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicProfile_userId_key" ON "ClinicProfile"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ClinicProfile_userId_fkey'
      AND table_name = 'ClinicProfile'
  ) THEN
    ALTER TABLE "ClinicProfile"
    ADD CONSTRAINT "ClinicProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;
