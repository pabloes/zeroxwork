-- CreateTable
CREATE TABLE "WalletDecentralandNames" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletDecentralandNames_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WalletDecentralandNames" ADD CONSTRAINT "WalletDecentralandNames_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
