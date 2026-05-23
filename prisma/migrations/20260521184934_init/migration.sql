-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RETAILER',
    "storeName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "color" TEXT NOT NULL,
    "colors" TEXT NOT NULL DEFAULT '[]',
    "occasion" TEXT NOT NULL DEFAULT '[]',
    "styleTags" TEXT NOT NULL DEFAULT '[]',
    "material" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'WOMEN',
    "season" TEXT NOT NULL DEFAULT '[]',
    "price" REAL NOT NULL,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sku" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "matchScore" REAL NOT NULL,
    "categoryScore" REAL NOT NULL,
    "colorScore" REAL NOT NULL,
    "occasionScore" REAL NOT NULL,
    "styleScore" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "explanation" TEXT NOT NULL,
    "explanationTags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "recommendations_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recommendations_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE INDEX "recommendations_sourceProductId_matchScore_idx" ON "recommendations"("sourceProductId", "matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_sourceProductId_targetProductId_key" ON "recommendations"("sourceProductId", "targetProductId");
