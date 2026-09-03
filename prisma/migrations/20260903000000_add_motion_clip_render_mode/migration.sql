-- Adds MotionClip.renderMode (ai-motion | pan-zoom), copied from
-- StoryboardShot.renderMode at clip creation so QA-reject/admin-reject
-- regeneration can read it directly off the row.
ALTER TABLE "motion_clips" ADD COLUMN "renderMode" TEXT NOT NULL DEFAULT 'ai-motion';
