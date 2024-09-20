/*
  Warnings:

  - A unique constraint covering the columns `[sha256Hash]` on the table `FileUpload` will be added. If there are existing duplicate values, this will fail.
  - Made the column `sha256Hash` on table `FileUpload` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FileUpload" ADD COLUMN     "analysisId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ALTER COLUMN "sha256Hash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_sha256Hash_key" ON "FileUpload"("sha256Hash");

-- CreateIndex
CREATE INDEX "FileUpload_sha256Hash_idx" ON "FileUpload"("sha256Hash");
