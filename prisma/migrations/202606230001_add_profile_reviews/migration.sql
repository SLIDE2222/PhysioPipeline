DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus') THEN
    CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'published', 'reported', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProfileReview" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
  "reportReason" TEXT,
  "reportedAt" TIMESTAMP(3),
  "reportedByUserId" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "moderatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfileReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProfileReview_profileId_status_idx" ON "ProfileReview"("profileId", "status");
CREATE INDEX IF NOT EXISTS "ProfileReview_status_createdAt_idx" ON "ProfileReview"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProfileReview_profileId_fkey'
      AND table_name = 'ProfileReview'
  ) THEN
    ALTER TABLE "ProfileReview"
      ADD CONSTRAINT "ProfileReview_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProfileReview_reportedByUserId_fkey'
      AND table_name = 'ProfileReview'
  ) THEN
    ALTER TABLE "ProfileReview"
      ADD CONSTRAINT "ProfileReview_reportedByUserId_fkey"
      FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProfileReview_moderatedByUserId_fkey'
      AND table_name = 'ProfileReview'
  ) THEN
    ALTER TABLE "ProfileReview"
      ADD CONSTRAINT "ProfileReview_moderatedByUserId_fkey"
      FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
