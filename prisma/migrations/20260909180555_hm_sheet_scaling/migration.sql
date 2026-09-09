-- AlterTable
ALTER TABLE "hm_products" ADD COLUMN     "minHeightM" DOUBLE PRECISION,
ADD COLUMN     "minWidthM" DOUBLE PRECISION,
ADD COLUMN     "patternType" TEXT NOT NULL DEFAULT 'customizable',
ADD COLUMN     "sheetHeightM" DOUBLE PRECISION,
ADD COLUMN     "sheetWidthM" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "hm_surfaces" ADD COLUMN     "adjacencyGroupId" TEXT;

-- CreateIndex
CREATE INDEX "hm_surfaces_adjacencyGroupId_idx" ON "hm_surfaces"("adjacencyGroupId");
