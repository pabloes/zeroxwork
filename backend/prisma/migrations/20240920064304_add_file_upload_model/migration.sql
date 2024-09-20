-- CreateTable
CREATE TABLE "FileUpload" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "md5Hash" TEXT,
    "sha256Hash" TEXT,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileUpload_userId_idx" ON "FileUpload"("userId");

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
