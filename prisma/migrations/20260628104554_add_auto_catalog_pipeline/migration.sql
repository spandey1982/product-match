-- CreateTable
CREATE TABLE "auto_catalog_batches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedCount" INTEGER NOT NULL DEFAULT 0,
    "classifiedCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "catalogedCount" INTEGER NOT NULL DEFAULT 0,
    "imagedCount" INTEGER NOT NULL DEFAULT 0,
    "qcPassedCount" INTEGER NOT NULL DEFAULT 0,
    "retryingCount" INTEGER NOT NULL DEFAULT 0,
    "manualQcCount" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_catalog_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_catalog_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "fileName" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT 'uploaded',
    "classificationResult" TEXT,
    "catalogResult" TEXT,
    "qcResult" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_catalog_batches_userId_idx" ON "auto_catalog_batches"("userId");

-- CreateIndex
CREATE INDEX "auto_catalog_items_batchId_idx" ON "auto_catalog_items"("batchId");

-- CreateIndex
CREATE INDEX "auto_catalog_items_userId_stage_idx" ON "auto_catalog_items"("userId", "stage");

-- AddForeignKey
ALTER TABLE "auto_catalog_items" ADD CONSTRAINT "auto_catalog_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "auto_catalog_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
