-- CreateTable
CREATE TABLE "fashion_designs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Design',
    "garmentType" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT 'uploading',
    "fabricAnalysis" TEXT,
    "designUnderstanding" TEXT,
    "accessoryAnalysis" TEXT,
    "generationPlan" TEXT,
    "flatFrontUrl" TEXT,
    "flatBackUrl" TEXT,
    "qualityScore" INTEGER,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fashion_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fashion_design_assets" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',

    CONSTRAINT "fashion_design_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fashion_designs_userId_idx" ON "fashion_designs"("userId");

-- CreateIndex
CREATE INDEX "fashion_design_assets_designId_idx" ON "fashion_design_assets"("designId");

-- AddForeignKey
ALTER TABLE "fashion_design_assets" ADD CONSTRAINT "fashion_design_assets_designId_fkey" FOREIGN KEY ("designId") REFERENCES "fashion_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
