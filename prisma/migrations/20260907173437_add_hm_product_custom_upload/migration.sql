-- AlterTable
ALTER TABLE "hm_products" ADD COLUMN     "uploadedByHmUserId" TEXT;

-- CreateIndex
CREATE INDEX "hm_products_uploadedByHmUserId_idx" ON "hm_products"("uploadedByHmUserId");

-- AddForeignKey
ALTER TABLE "hm_products" ADD CONSTRAINT "hm_products_uploadedByHmUserId_fkey" FOREIGN KEY ("uploadedByHmUserId") REFERENCES "hm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
