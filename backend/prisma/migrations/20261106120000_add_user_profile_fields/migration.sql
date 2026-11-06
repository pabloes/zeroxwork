-- AlterTable: optional public profile fields on users.
-- Both columns are nullable and have no default, so every existing row keeps
-- NULL and nothing is rewritten or dropped.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
