-- Presenter Reel content-strategy upgrade — additive columns only, no
-- changes to existing columns or tables (see prisma/schema.prisma's
-- PresenterReelJob model comments for full rationale).

ALTER TABLE "presenter_reel_jobs" ADD COLUMN "templateId" TEXT NOT NULL DEFAULT 'value_trust';
ALTER TABLE "presenter_reel_jobs" ADD COLUMN "durationSec" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "presenter_reel_jobs" ADD COLUMN "ctaMode" TEXT NOT NULL DEFAULT 'on_screen';
ALTER TABLE "presenter_reel_jobs" ADD COLUMN "ctaText" TEXT;
ALTER TABLE "presenter_reel_jobs" ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'full_script';
ALTER TABLE "presenter_reel_jobs" ADD COLUMN "endCardData" TEXT;
