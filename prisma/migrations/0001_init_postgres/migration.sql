
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RETAILER',
    "storeName" TEXT,
    "tryOnProvider" TEXT NOT NULL DEFAULT 'gemini',
    "aiGenSettings" TEXT,
    "logoPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "color" TEXT NOT NULL,
    "colors" TEXT NOT NULL DEFAULT '[]',
    "occasion" TEXT NOT NULL DEFAULT '[]',
    "styleTags" TEXT NOT NULL DEFAULT '[]',
    "material" TEXT,
    "pattern" TEXT,
    "detailNotes" TEXT,
    "backDetailNotes" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'WOMEN',
    "season" TEXT NOT NULL DEFAULT '[]',
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "backImageUrl" TEXT,
    "partImages" TEXT,
    "thumbnailUrl" TEXT,
    "modelImageUrl" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sku" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_records" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "modelName" TEXT,
    "category" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "outputUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "fileSizeBytes" INTEGER,
    "generationMs" INTEGER,
    "tokensTotal" INTEGER,
    "aiAuthenticity" DOUBLE PRECISION,
    "aiRealism" DOUBLE PRECISION,
    "aiGarmentPreservation" DOUBLE PRECISION,
    "aiDrapeQuality" DOUBLE PRECISION,
    "aiPatternPreservation" DOUBLE PRECISION,
    "aiRenderingQuality" DOUBLE PRECISION,
    "aiTextureQuality" DOUBLE PRECISION,
    "aiProductVisibility" DOUBLE PRECISION,
    "aiOverall" DOUBLE PRECISION,
    "aiIssues" TEXT,
    "aiReviewModel" TEXT,
    "aiReviewedAt" TIMESTAMP(3),
    "manualScore" INTEGER,
    "manualReviewer" TEXT,
    "manualReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "operation" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "imagesGenerated" INTEGER NOT NULL DEFAULT 0,
    "imageInputs" INTEGER NOT NULL DEFAULT 0,
    "requestBytes" INTEGER,
    "responseBytes" INTEGER,
    "durationMs" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "pricingVersion" TEXT,
    "storeId" TEXT,
    "userId" TEXT,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "categoryScore" DOUBLE PRECISION NOT NULL,
    "colorScore" DOUBLE PRECISION NOT NULL,
    "occasionScore" DOUBLE PRECISION NOT NULL,
    "styleScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "explanationTags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_userId_idx" ON "products"("userId");

-- CreateIndex
CREATE INDEX "products_color_idx" ON "products"("color");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE INDEX "generation_records_provider_category_idx" ON "generation_records"("provider", "category");

-- CreateIndex
CREATE INDEX "generation_records_productId_idx" ON "generation_records"("productId");

-- CreateIndex
CREATE INDEX "generation_records_objective_idx" ON "generation_records"("objective");

-- CreateIndex
CREATE INDEX "ai_usage_events_provider_model_idx" ON "ai_usage_events"("provider", "model");

-- CreateIndex
CREATE INDEX "ai_usage_events_feature_createdAt_idx" ON "ai_usage_events"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_events_storeId_createdAt_idx" ON "ai_usage_events"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_events_createdAt_idx" ON "ai_usage_events"("createdAt");

-- CreateIndex
CREATE INDEX "recommendations_sourceProductId_matchScore_idx" ON "recommendations"("sourceProductId", "matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_sourceProductId_targetProductId_key" ON "recommendations"("sourceProductId", "targetProductId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

