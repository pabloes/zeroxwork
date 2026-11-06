-- CreateTable
CREATE TABLE "discord_role_grants" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roleKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_role_grants_userId_idx" ON "discord_role_grants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "discord_role_grants_userId_roleKey_key" ON "discord_role_grants"("userId", "roleKey");

-- AddForeignKey
ALTER TABLE "discord_role_grants" ADD CONSTRAINT "discord_role_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
