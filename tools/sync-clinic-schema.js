import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function execute(statement) {
  await prisma.$executeRawUnsafe(statement);
}

async function main() {
  // Render may start from an older production database where Prisma Client
  // already expects profile/account/clinic columns. Keep this sync idempotent and
  // additive so startup can repair the missing columns without destructive
  // `prisma db push --accept-data-loss` behavior.
  const profileColumns = [
    ["secondarySpecialty", "TEXT"],
    ["tertiarySpecialty", "TEXT"],
  ];

  for (const [column, type] of profileColumns) {
    await execute(`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "${column}" ${type};`);
  }

  await execute(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
        CREATE TYPE "AccountType" AS ENUM ('physio', 'clinic');
      END IF;
    END $$;
  `);

  await execute(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'physio';
  `);

  await execute(`
    UPDATE "User"
    SET "accountType" = 'physio'
    WHERE "accountType" IS NULL;
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "ClinicProfile" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "clinicName" TEXT,
      "responsibleName" TEXT,
      "address" TEXT,
      "city" TEXT,
      "neighborhood" TEXT,
      "phone" TEXT,
      "whatsapp" TEXT,
      "services" TEXT,
      "physioTeam" TEXT,
      "logoUrl" TEXT,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClinicProfile_pkey" PRIMARY KEY ("id")
    );
  `);

  const clinicColumns = [
    ["responsibleName", "TEXT"],
    ["address", "TEXT"],
    ["city", "TEXT"],
    ["neighborhood", "TEXT"],
    ["phone", "TEXT"],
    ["whatsapp", "TEXT"],
    ["services", "TEXT"],
    ["physioTeam", "TEXT"],
    ["logoUrl", "TEXT"],
    ["description", "TEXT"],
  ];

  for (const [column, type] of clinicColumns) {
    await execute(`ALTER TABLE "ClinicProfile" ADD COLUMN IF NOT EXISTS "${column}" ${type};`);
  }

  await execute(`
    ALTER TABLE "ClinicProfile"
    ALTER COLUMN "userId" DROP NOT NULL;
  `);

  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ClinicProfile_userId_key"
    ON "ClinicProfile"("userId");
  `);

  await execute(`
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
  `);

  console.log("Profile/clinic/account schema sync completed.");
}

main()
  .catch((error) => {
    console.error("Clinic/account schema sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
