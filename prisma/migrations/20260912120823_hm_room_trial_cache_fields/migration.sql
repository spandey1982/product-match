-- AlterTable
ALTER TABLE "hm_visualizations" ADD COLUMN     "cacheKey" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "savedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "hm_visualizations_surfaceId_cacheKey_idx" ON "hm_visualizations"("surfaceId", "cacheKey");
