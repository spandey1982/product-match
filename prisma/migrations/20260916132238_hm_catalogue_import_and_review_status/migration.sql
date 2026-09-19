-- AlterTable
ALTER TABLE "hm_products" ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'published';

-- CreateTable
CREATE TABLE "hm_catalogue_imports" (
    "id" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "brand" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_catalogue_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_catalogue_import_pages" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "pageType" TEXT NOT NULL,
    "extractedImageUrl" TEXT,
    "extractedFields" TEXT NOT NULL DEFAULT '{}',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "resultingProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hm_catalogue_import_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hm_catalogue_imports_status_idx" ON "hm_catalogue_imports"("status");

-- CreateIndex
CREATE INDEX "hm_catalogue_import_pages_importId_reviewStatus_idx" ON "hm_catalogue_import_pages"("importId", "reviewStatus");

-- CreateIndex
CREATE INDEX "hm_products_reviewStatus_idx" ON "hm_products"("reviewStatus");

-- AddForeignKey
ALTER TABLE "hm_catalogue_imports" ADD CONSTRAINT "hm_catalogue_imports_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_catalogue_import_pages" ADD CONSTRAINT "hm_catalogue_import_pages_importId_fkey" FOREIGN KEY ("importId") REFERENCES "hm_catalogue_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_catalogue_import_pages" ADD CONSTRAINT "hm_catalogue_import_pages_resultingProductId_fkey" FOREIGN KEY ("resultingProductId") REFERENCES "hm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
