-- AI Presenter Reel — additive only, no changes to existing tables (see
-- prisma/schema.prisma's "AI Presenter Reel" section for full comments).

-- CreateTable
CREATE TABLE "presenter_personas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faceRegistryId" TEXT NOT NULL,
    "voiceProviderId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presenter_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presenter_reel_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "providerJobId" TEXT,
    "videoUrl" TEXT,
    "durationMs" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presenter_reel_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presenter_personas_deletedAt_idx" ON "presenter_personas"("deletedAt");

-- CreateIndex
CREATE INDEX "presenter_reel_jobs_userId_status_idx" ON "presenter_reel_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "presenter_reel_jobs_productId_idx" ON "presenter_reel_jobs"("productId");

-- AddForeignKey
ALTER TABLE "presenter_reel_jobs" ADD CONSTRAINT "presenter_reel_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenter_reel_jobs" ADD CONSTRAINT "presenter_reel_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenter_reel_jobs" ADD CONSTRAINT "presenter_reel_jobs_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "presenter_personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
