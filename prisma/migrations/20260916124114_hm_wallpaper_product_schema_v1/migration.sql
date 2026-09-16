-- AlterTable
ALTER TABLE "hm_products" ADD COLUMN     "colorFamily" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "installationMethod" TEXT,
ADD COLUMN     "materialComposition" TEXT,
ADD COLUMN     "patternCategory" TEXT,
ADD COLUMN     "sampleAvailable" BOOLEAN,
ADD COLUMN     "visualStyle" TEXT;

-- AlterTable
ALTER TABLE "hm_product_evidence" ADD COLUMN     "sourceAuthority" TEXT;

-- CreateTable
CREATE TABLE "hm_product_families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hm_product_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_product_events" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "hmUserId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hm_product_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hm_product_events_productId_eventType_createdAt_idx" ON "hm_product_events"("productId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "hm_product_events_sessionId_idx" ON "hm_product_events"("sessionId");

-- CreateIndex
CREATE INDEX "hm_products_familyId_idx" ON "hm_products"("familyId");

-- AddForeignKey
ALTER TABLE "hm_products" ADD CONSTRAINT "hm_products_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "hm_product_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_product_events" ADD CONSTRAINT "hm_product_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_product_events" ADD CONSTRAINT "hm_product_events_hmUserId_fkey" FOREIGN KEY ("hmUserId") REFERENCES "hm_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

