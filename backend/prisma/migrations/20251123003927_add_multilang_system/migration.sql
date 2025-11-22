-- Step 1: Add new columns to articles as nullable first
ALTER TABLE "articles" ADD COLUMN "slug" TEXT;
ALTER TABLE "articles" ADD COLUMN "lang" TEXT DEFAULT 'es';
ALTER TABLE "articles" ADD COLUMN "sourceHash" TEXT;

-- Step 2: Generate slugs for existing articles
UPDATE "articles"
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')),
    "lang" = 'es',
    "sourceHash" = '';

-- Step 3: Ensure slugs are unique by appending id if duplicates exist
UPDATE "articles" a
SET "slug" = a."slug" || '-' || a.id
WHERE EXISTS (
    SELECT 1 FROM "articles" b
    WHERE b."slug" = a."slug" AND b.id < a.id
);

-- Step 4: Make slug NOT NULL and add unique constraint
ALTER TABLE "articles" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "articles" ADD CONSTRAINT "articles_slug_key" UNIQUE ("slug");

-- Step 5: Create index on slug
CREATE INDEX "articles_slug_idx" ON "articles"("slug");

-- Step 6: Create ArticleTranslation table
CREATE TABLE "article_translations" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "targetLang" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceHash" TEXT,
    "provider" TEXT,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_translations_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create ArticleSlug table (history)
CREATE TABLE "article_slugs" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_slugs_pkey" PRIMARY KEY ("id")
);

-- Step 8: Add unique constraints and indexes
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_slug_key" UNIQUE ("slug");
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_articleId_targetLang_key" UNIQUE ("articleId", "targetLang");
CREATE INDEX "article_translations_slug_idx" ON "article_translations"("slug");
CREATE INDEX "article_translations_articleId_idx" ON "article_translations"("articleId");

ALTER TABLE "article_slugs" ADD CONSTRAINT "article_slugs_slug_key" UNIQUE ("slug");
CREATE INDEX "article_slugs_articleId_idx" ON "article_slugs"("articleId");
CREATE INDEX "article_slugs_lang_idx" ON "article_slugs"("lang");

-- Step 9: Add foreign keys
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_slugs" ADD CONSTRAINT "article_slugs_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Create initial slug history for existing articles
INSERT INTO "article_slugs" ("articleId", "lang", "slug", "isCurrent")
SELECT id, lang, slug, true FROM "articles";
