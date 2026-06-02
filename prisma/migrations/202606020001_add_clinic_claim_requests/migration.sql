ALTER TABLE "ClinicProfile"
ALTER COLUMN "userId" DROP NOT NULL;

CREATE TABLE "ClinicClaimRequest" (
  "id" TEXT NOT NULL,
  "clinicProfileId" TEXT NOT NULL,
  "clinicName" TEXT,
  "cnpj" TEXT NOT NULL,
  "responsibleName" TEXT NOT NULL,
  "responsibleEmail" TEXT NOT NULL,
  "whatsapp" TEXT,
  "roleOrRelation" TEXT NOT NULL,
  "authorizationConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "proofFileName" TEXT,
  "proofFileMime" TEXT,
  "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClinicClaimRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicClaimRequest_clinicProfileId_status_idx"
ON "ClinicClaimRequest"("clinicProfileId", "status");

ALTER TABLE "ClinicClaimRequest"
ADD CONSTRAINT "ClinicClaimRequest_clinicProfileId_fkey"
FOREIGN KEY ("clinicProfileId") REFERENCES "ClinicProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;