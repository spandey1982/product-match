-- CreateTable
CREATE TABLE "hm_users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_projects" (
    "id" TEXT NOT NULL,
    "hmUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Home',
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_rooms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "analysisState" TEXT NOT NULL DEFAULT 'pending',
    "analysisResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_surfaces" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "surfaceType" TEXT NOT NULL DEFAULT 'wall',
    "label" TEXT,
    "geometryData" TEXT,
    "widthMeters" DOUBLE PRECISION,
    "heightMeters" DOUBLE PRECISION,
    "areaSqm" DOUBLE PRECISION,
    "measurementSource" TEXT NOT NULL DEFAULT 'ai_estimated',
    "measurementConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_surfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_materials" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durability" TEXT,
    "maintenance" TEXT,
    "moistureSuitability" TEXT,
    "installationNotes" TEXT,
    "removalNotes" TEXT,
    "avgCostPerSqftMinInr" DOUBLE PRECISION,
    "avgCostPerSqftMaxInr" DOUBLE PRECISION,
    "advantages" TEXT NOT NULL DEFAULT '[]',
    "limitations" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_products" (
    "id" TEXT NOT NULL,
    "materialId" TEXT,
    "sku" TEXT,
    "brand" TEXT,
    "collection" TEXT,
    "name" TEXT NOT NULL,
    "colorName" TEXT,
    "colorHex" TEXT,
    "finish" TEXT,
    "patternName" TEXT,
    "patternRepeatCm" DOUBLE PRECISION,
    "orientation" TEXT,
    "dimensions" TEXT,
    "priceInr" DOUBLE PRECISION,
    "priceUnit" TEXT,
    "warrantyInfo" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'unspecified',
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "textureAssetUrl" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_product_evidence" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceDetail" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hm_product_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_retailers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "serviceArea" TEXT,
    "categories" TEXT NOT NULL DEFAULT '[]',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_retailer_products" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceInr" DOUBLE PRECISION,
    "availability" TEXT NOT NULL DEFAULT 'unspecified',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_retailer_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_visualizations" (
    "id" TEXT NOT NULL,
    "surfaceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "materialId" TEXT,
    "productId" TEXT,
    "inputImageUrl" TEXT NOT NULL,
    "outputImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "model" TEXT,
    "generationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_visualizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_recommendations" (
    "id" TEXT NOT NULL,
    "surfaceId" TEXT NOT NULL,
    "materialId" TEXT,
    "productId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasons" TEXT NOT NULL DEFAULT '[]',
    "concerns" TEXT NOT NULL DEFAULT '[]',
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hm_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_shortlist_items" (
    "id" TEXT NOT NULL,
    "hmUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hm_shortlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hm_leads" (
    "id" TEXT NOT NULL,
    "hmUserId" TEXT NOT NULL,
    "projectId" TEXT,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT,
    "materialCategory" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "message" TEXT,
    "estimatedAreaSqm" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hm_users_phone_key" ON "hm_users"("phone");

-- CreateIndex
CREATE INDEX "hm_projects_hmUserId_idx" ON "hm_projects"("hmUserId");

-- CreateIndex
CREATE INDEX "hm_rooms_projectId_idx" ON "hm_rooms"("projectId");

-- CreateIndex
CREATE INDEX "hm_surfaces_roomId_idx" ON "hm_surfaces"("roomId");

-- CreateIndex
CREATE INDEX "hm_materials_category_idx" ON "hm_materials"("category");

-- CreateIndex
CREATE INDEX "hm_products_materialId_idx" ON "hm_products"("materialId");

-- CreateIndex
CREATE INDEX "hm_product_evidence_productId_field_idx" ON "hm_product_evidence"("productId", "field");

-- CreateIndex
CREATE INDEX "hm_retailer_products_productId_idx" ON "hm_retailer_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "hm_retailer_products_retailerId_productId_key" ON "hm_retailer_products"("retailerId", "productId");

-- CreateIndex
CREATE INDEX "hm_visualizations_surfaceId_idx" ON "hm_visualizations"("surfaceId");

-- CreateIndex
CREATE INDEX "hm_recommendations_surfaceId_score_idx" ON "hm_recommendations"("surfaceId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "hm_shortlist_items_hmUserId_productId_key" ON "hm_shortlist_items"("hmUserId", "productId");

-- CreateIndex
CREATE INDEX "hm_leads_retailerId_status_idx" ON "hm_leads"("retailerId", "status");

-- CreateIndex
CREATE INDEX "hm_leads_hmUserId_idx" ON "hm_leads"("hmUserId");

-- AddForeignKey
ALTER TABLE "hm_projects" ADD CONSTRAINT "hm_projects_hmUserId_fkey" FOREIGN KEY ("hmUserId") REFERENCES "hm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_rooms" ADD CONSTRAINT "hm_rooms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hm_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_surfaces" ADD CONSTRAINT "hm_surfaces_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hm_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_products" ADD CONSTRAINT "hm_products_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "hm_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_product_evidence" ADD CONSTRAINT "hm_product_evidence_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_retailer_products" ADD CONSTRAINT "hm_retailer_products_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "hm_retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_retailer_products" ADD CONSTRAINT "hm_retailer_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_visualizations" ADD CONSTRAINT "hm_visualizations_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "hm_surfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_visualizations" ADD CONSTRAINT "hm_visualizations_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "hm_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_visualizations" ADD CONSTRAINT "hm_visualizations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_recommendations" ADD CONSTRAINT "hm_recommendations_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "hm_surfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_recommendations" ADD CONSTRAINT "hm_recommendations_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "hm_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_recommendations" ADD CONSTRAINT "hm_recommendations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_shortlist_items" ADD CONSTRAINT "hm_shortlist_items_hmUserId_fkey" FOREIGN KEY ("hmUserId") REFERENCES "hm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_shortlist_items" ADD CONSTRAINT "hm_shortlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_leads" ADD CONSTRAINT "hm_leads_hmUserId_fkey" FOREIGN KEY ("hmUserId") REFERENCES "hm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_leads" ADD CONSTRAINT "hm_leads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hm_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_leads" ADD CONSTRAINT "hm_leads_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "hm_retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_leads" ADD CONSTRAINT "hm_leads_productId_fkey" FOREIGN KEY ("productId") REFERENCES "hm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
