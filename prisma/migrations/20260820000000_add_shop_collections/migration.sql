-- CreateTable
CREATE TABLE "shop_collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productIds" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shop_collections_createdAt_idx" ON "shop_collections"("createdAt");
