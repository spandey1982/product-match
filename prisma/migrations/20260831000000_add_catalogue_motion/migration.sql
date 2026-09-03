-- AlterTable
ALTER TABLE "ai_usage_events" ADD COLUMN     "videoSeconds" INTEGER;

-- CreateTable
CREATE TABLE "motion_jobs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "intensity" TEXT NOT NULL DEFAULT 'elegant',
    "storyboardId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "directorPlan" TEXT,
    "duration" INTEGER,
    "outputUrl" TEXT,
    "outputFormat" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motion_clips" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "shotIndex" INTEGER NOT NULL,
    "view" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "sourceImageUrl" TEXT NOT NULL,
    "plannedHoldSec" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "outputUrl" TEXT,
    "durationMs" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motion_clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motion_qa_results" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "identityConsistency" DOUBLE PRECISION,
    "garmentPreservation" DOUBLE PRECISION,
    "textureConsistency" DOUBLE PRECISION,
    "lightingStability" DOUBLE PRECISION,
    "backgroundStability" DOUBLE PRECISION,
    "motionSmoothness" DOUBLE PRECISION,
    "artifactScore" DOUBLE PRECISION,
    "overall" DOUBLE PRECISION,
    "issues" TEXT,
    "verdict" TEXT NOT NULL,
    "reviewModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motion_qa_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "motion_jobs_productId_idx" ON "motion_jobs"("productId");

-- CreateIndex
CREATE INDEX "motion_jobs_userId_status_idx" ON "motion_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "motion_clips_jobId_idx" ON "motion_clips"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "motion_qa_results_clipId_key" ON "motion_qa_results"("clipId");

-- AddForeignKey
ALTER TABLE "motion_jobs" ADD CONSTRAINT "motion_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motion_jobs" ADD CONSTRAINT "motion_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motion_clips" ADD CONSTRAINT "motion_clips_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "motion_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motion_qa_results" ADD CONSTRAINT "motion_qa_results_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "motion_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
