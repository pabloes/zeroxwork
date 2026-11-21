-- CreateTable
CREATE TABLE "repo_watches" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "branch" TEXT,
    "lastSha" TEXT,
    "lastPostedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repo_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repo_watches_projectId_key" ON "repo_watches"("projectId");

-- CreateIndex
CREATE INDEX "repo_watches_enabled_idx" ON "repo_watches"("enabled");

-- AddForeignKey
ALTER TABLE "repo_watches" ADD CONSTRAINT "repo_watches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
