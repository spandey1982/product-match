-- CreateTable
CREATE TABLE "garment_intelligence" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "promptNotes" TEXT NOT NULL,
    "analyzedImageUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "garment_intelligence_productId_key" ON "garment_intelligence"("productId");

-- AddForeignKey
ALTER TABLE "garment_intelligence" ADD CONSTRAINT "garment_intelligence_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
