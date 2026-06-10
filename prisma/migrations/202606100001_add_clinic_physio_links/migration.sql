DO $$ BEGIN
  CREATE TYPE "ClinicPhysioLinkStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'UNLINKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ClinicPhysiotherapistLink" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "status" "ClinicPhysioLinkStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "unlinkedAt" TIMESTAMP(3),

  CONSTRAINT "ClinicPhysiotherapistLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicPhysiotherapistLink_clinicId_profileId_key"
ON "ClinicPhysiotherapistLink"("clinicId", "profileId");

CREATE INDEX IF NOT EXISTS "ClinicPhysiotherapistLink_clinicId_status_idx"
ON "ClinicPhysiotherapistLink"("clinicId", "status");

CREATE INDEX IF NOT EXISTS "ClinicPhysiotherapistLink_profileId_status_idx"
ON "ClinicPhysiotherapistLink"("profileId", "status");

DO $$ BEGIN
  ALTER TABLE "ClinicPhysiotherapistLink"
  ADD CONSTRAINT "ClinicPhysiotherapistLink_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "ClinicProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClinicPhysiotherapistLink"
  ADD CONSTRAINT "ClinicPhysiotherapistLink_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
