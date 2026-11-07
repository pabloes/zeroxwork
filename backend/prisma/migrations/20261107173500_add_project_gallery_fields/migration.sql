-- Project gallery: an ordered list of screenshot paths and one external video
-- embed URL. Both additive and nullable-by-default, so existing articles are
-- untouched: Prisma reads a NULL TEXT[] as an empty list.
-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "screenshots" TEXT[],
ADD COLUMN     "videoUrl" TEXT;
