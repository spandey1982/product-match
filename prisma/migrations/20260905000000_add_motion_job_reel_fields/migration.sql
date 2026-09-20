-- Adds the ad/marketing "reel" deliverable alongside the existing catalogue
-- video on MotionJob. All three columns are additive (defaulted or
-- nullable), so every existing row (implicitly deliverable = 'catalogue')
-- is unaffected.
ALTER TABLE "motion_jobs" ADD COLUMN "deliverable" TEXT NOT NULL DEFAULT 'catalogue';
ALTER TABLE "motion_jobs" ADD COLUMN "archetype" TEXT;
ALTER TABLE "motion_jobs" ADD COLUMN "presentation" TEXT;
