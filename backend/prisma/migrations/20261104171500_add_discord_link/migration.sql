-- CreateTable
CREATE TABLE "discord_links" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_links_userId_key" ON "discord_links"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "discord_links_discordId_key" ON "discord_links"("discordId");

-- AddForeignKey
ALTER TABLE "discord_links" ADD CONSTRAINT "discord_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
