-- CreateTable
CREATE TABLE "model_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faceId" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "poseMode" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_profiles_userId_deletedAt_idx" ON "model_profiles"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "model_profiles" ADD CONSTRAINT "model_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
