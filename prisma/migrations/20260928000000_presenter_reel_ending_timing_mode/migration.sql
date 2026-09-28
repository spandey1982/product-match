-- Presenter Reel end-card v2 — additive column only, no changes to
-- existing columns or tables (see prisma/schema.prisma's PresenterReelJob
-- model comments for full rationale).

ALTER TABLE "presenter_reel_jobs" ADD COLUMN "endingTimingMode" TEXT NOT NULL DEFAULT 'smart';
