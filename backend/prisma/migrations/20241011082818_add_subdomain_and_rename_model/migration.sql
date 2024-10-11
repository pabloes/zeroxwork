/*
  Warnings:

  - You are about to drop the `WalletNames` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WalletNames" DROP CONSTRAINT "WalletNames_walletId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_defaultNameId_fkey";

-- DropTable
DROP TABLE "WalletNames";

-- CreateTable
CREATE TABLE "WalletDecentralandNames" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletDecentralandNames_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_defaultNameId_fkey" FOREIGN KEY ("defaultNameId") REFERENCES "WalletDecentralandNames"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletDecentralandNames" ADD CONSTRAINT "WalletDecentralandNames_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
