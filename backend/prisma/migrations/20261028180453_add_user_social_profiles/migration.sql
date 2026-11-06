-- CreateTable
CREATE TABLE "user_socials" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_socials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_socials_userId_idx" ON "user_socials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_socials_userId_network_key" ON "user_socials"("userId", "network");

-- AddForeignKey
ALTER TABLE "user_socials" ADD CONSTRAINT "user_socials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
