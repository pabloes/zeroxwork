-- Public member handles and project credits.
--
-- Everything here is additive: one nullable column on "users" and one new
-- table. No existing row is rewritten and nothing is dropped.

-- AlterTable: the handle is the address of the public member page,
-- /member/<handle>. Nullable, so every existing account keeps NULL and simply
-- has no public page until it claims one.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "handle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_handle_key" ON "users"("handle");

-- CreateTable: people credited on an article. "name" is always stored so
-- collaborators without an account can be credited; "userId" links the credit
-- to a ZEROxWORK account when there is one.
CREATE TABLE IF NOT EXISTS "article_credits" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "article_credits_articleId_idx" ON "article_credits"("articleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "article_credits_userId_idx" ON "article_credits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "article_credits_articleId_name_key" ON "article_credits"("articleId", "name");

-- AddForeignKey: deleting an article takes its credit rows with it.
ALTER TABLE "article_credits" ADD CONSTRAINT "article_credits_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: deleting an account only unlinks the credit, the name stays.
ALTER TABLE "article_credits" ADD CONSTRAINT "article_credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
