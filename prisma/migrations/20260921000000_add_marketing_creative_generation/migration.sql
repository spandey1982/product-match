-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "brandTier" TEXT NOT NULL DEFAULT 'mid-market',
ADD COLUMN     "priceVisibility" TEXT NOT NULL DEFAULT 'moderate';

-- CreateTable
CREATE TABLE "marketing_creative_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedHeroSourceMode" TEXT NOT NULL DEFAULT 'auto',
    "heroSourceMode" TEXT NOT NULL,
    "templateFamily" TEXT NOT NULL DEFAULT 'hero-promo',
    "contentMode" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "platform" TEXT,
    "aspectRatios" TEXT NOT NULL,
    "outputs" TEXT NOT NULL DEFAULT '[]',
    "heroImageUrl" TEXT,
    "heroSourceProductImageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_creative_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_creative_jobs_userId_status_idx" ON "marketing_creative_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "marketing_creative_jobs_productId_idx" ON "marketing_creative_jobs"("productId");

-- AddForeignKey
ALTER TABLE "marketing_creative_jobs" ADD CONSTRAINT "marketing_creative_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_creative_jobs" ADD CONSTRAINT "marketing_creative_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

