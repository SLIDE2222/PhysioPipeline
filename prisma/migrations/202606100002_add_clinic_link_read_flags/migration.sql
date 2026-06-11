ALTER TABLE "ClinicPhysiotherapistLink"
ADD COLUMN IF NOT EXISTS "readByClinic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "readByPhysio" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ClinicPhysiotherapistLink"
SET "readByClinic" = true
WHERE "status" = 'PENDING';
