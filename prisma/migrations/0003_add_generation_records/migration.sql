-- Generation performance + quality records (Phase E). Standalone analytics
-- table (no FK to products) so records survive product edits/deletes.
CREATE TABLE "generation_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "outputUrl" TEXT NOT NULL,
    "generationMs" INTEGER,
    "tokensTotal" INTEGER,
    "aiAuthenticity" REAL,
    "aiRealism" REAL,
    "aiGarmentPreservation" REAL,
    "aiDrapeQuality" REAL,
    "aiPatternPreservation" REAL,
    "aiRenderingQuality" REAL,
    "aiOverall" REAL,
    "aiReviewModel" TEXT,
    "aiReviewedAt" DATETIME,
    "manualScore" INTEGER,
    "manualReviewer" TEXT,
    "manualReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "generation_records_provider_category_idx" ON "generation_records"("provider", "category");
CREATE INDEX "generation_records_productId_idx" ON "generation_records"("productId");
CREATE INDEX "generation_records_objective_idx" ON "generation_records"("objective");
