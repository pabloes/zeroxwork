-- AlterTable: add embedUrl and embedHeight columns
-- NOTE: script column is kept temporarily for backfill migration.
-- It will be dropped in a future migration after data is migrated.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "embedUrl" TEXT;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "embedHeight" INTEGER DEFAULT 600;
