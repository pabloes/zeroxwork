/*
  Warnings:

  - A unique constraint covering the columns `[defaultNameId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultNameId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_defaultNameId_key" ON "users"("defaultNameId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_defaultNameId_fkey" FOREIGN KEY ("defaultNameId") REFERENCES "WalletDecentralandNames"("id") ON DELETE SET NULL ON UPDATE CASCADE;
