-- AlterTable
-- Additive, with a default that keeps every existing project showing its
-- repository exactly as it did before the choice existed.
ALTER TABLE "projects" ADD COLUMN "repoUrlPublic" BOOLEAN NOT NULL DEFAULT true;
