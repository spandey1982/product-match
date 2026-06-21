-- Append-only AI cost/usage ledger: one row per billable AI API call. Single
-- source of truth for AI operating cost (quality stays on generation_records).
-- Provider/model/feature are plain strings so new providers/features need no
-- schema change; raw drivers + a stamped pricingVersion keep estimates
-- reproducible and re-priceable.
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "estimatedCostUsd" REAL,
    "pricingVersion" TEXT,
    "storeId" TEXT,
    "userId" TEXT,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ai_usage_events_provider_model_idx" ON "ai_usage_events"("provider", "model");
CREATE INDEX "ai_usage_events_feature_createdAt_idx" ON "ai_usage_events"("feature", "createdAt");
CREATE INDEX "ai_usage_events_storeId_createdAt_idx" ON "ai_usage_events"("storeId", "createdAt");
CREATE INDEX "ai_usage_events_createdAt_idx" ON "ai_usage_events"("createdAt");
