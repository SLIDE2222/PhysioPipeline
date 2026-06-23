ALTER TYPE "ReviewStatus" RENAME VALUE 'pending' TO 'pending_admin';
ALTER TYPE "ReviewStatus" RENAME VALUE 'published' TO 'approved';
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'pending_owner';