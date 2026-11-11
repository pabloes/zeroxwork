-- CreateTable
CREATE TABLE "discord_sync_jobs" (
    "id" SERIAL NOT NULL,
    "discordId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_sync_jobs_createdAt_idx" ON "discord_sync_jobs"("createdAt");
