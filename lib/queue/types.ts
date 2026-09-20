/**
 * Job queue names and payload types for pg-boss queues.
 *
 * Each queue name is a constant so typos are caught at compile time.
 * Payload interfaces define what data each job carries — the contract
 * between the producer (orchestrator) and the consumer (worker).
 */

export const QUEUES = {
  MOTION_RENDER: "motion.render",
  MOTION_QA: "motion.qa",
  MOTION_COMPOSE: "motion.compose",
  // AI Presenter Reel — a genuinely separate deliverable from the three
  // above (talking-avatar dialogue, not camera-motion catalogue video; see
  // lib/presenter-reel/). One queue, not three: a single Veo call produces
  // the whole clip (script, voice, lip-sync, gesture together), so there's
  // no separate QA/compose stage the multi-clip motion pipeline needs.
  PRESENTER_RENDER: "presenter.render",
} as const;

/**
 * Per-queue retry/expiration/retention policy, applied once via
 * boss.createQueue() when the queue is first registered (see boss.ts).
 * Matches the topology in the architecture spec: render jobs get 2 retries
 * with backoff (transient provider failures resolve on retry), QA jobs get
 * 1 retry with no backoff (a QA failure escalates to manual review rather
 * than retrying blind), compose jobs get 1 retry on a short fixed delay.
 */
export const QUEUE_OPTIONS: Record<(typeof QUEUES)[keyof typeof QUEUES], {
  retryLimit: number;
  retryDelay: number;
  retryBackoff?: boolean;
  expireInSeconds: number;
}> = {
  [QUEUES.MOTION_RENDER]: { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 180 },
  [QUEUES.MOTION_QA]: { retryLimit: 1, retryDelay: 0, expireInSeconds: 60 },
  [QUEUES.MOTION_COMPOSE]: { retryLimit: 1, retryDelay: 15, expireInSeconds: 120 },
  // Same 2-retry/backoff shape as MOTION_RENDER (transient provider failures
  // resolve on retry) — no equivalent yet to MOTION_RENDER's lower reel
  // ceiling, since there's no live-test evidence yet of a systematic,
  // category-level failure mode for this deliverable the way dense-pattern
  // garments were for the reel engine. Revisit once real volume exists.
  [QUEUES.PRESENTER_RENDER]: { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 180 },
};

export interface MotionRenderPayload {
  clipId: string;
  jobId: string;
  sourceImageUrl: string;
  presetId: string;
  /** ai-motion (Veo) | pan-zoom (local deterministic FFmpeg, zero cost, zero hallucination risk). From StoryboardShot.renderMode. */
  renderMode: "ai-motion" | "pan-zoom";
  /** Extra garment-motion instruction from the director's plan, if any (see DirectorShotPlan.motionEmphasis). Ignored for pan-zoom shots — nothing to instruct. */
  motionEmphasis?: string;
  intensity: string;
  /** The director's planned on-screen hold. ai-motion rounds this up to Veo's nearest allowed generation length; pan-zoom renders at this exact duration. */
  durationSec: number;
  cropRegion?: { x: number; y: number; w: number; h: number };
  /** "reel" routes ai-motion shots through reel-prompt-builder.ts instead of prompt-builder.ts. Undefined/"catalogue" = today's behavior, unchanged. */
  deliverable?: "catalogue" | "reel";
  /** Reel-only: which engagement-permissive constraint variant to use. Required when deliverable is "reel" and renderMode is "ai-motion". */
  presentation?: "model" | "mannequin";
  /** Reel-only: the one action this shot should show (ReelStoryboardShot.engagementCue). Required alongside presentation. */
  engagementCue?: string;
  /** Reel-only: per-material lighting instruction (lib/catalogue-motion/reel/lighting.ts), computed once per job. */
  lightingDescriptor?: string;
  /** Reel-only: ReelStoryboardShot.isDetailTruth — selects the fabric-only constraint block (no person/hand implied) and skips depth-of-field, since these crops are confirmed pure fabric with no separate background. */
  isDetailTruth?: boolean;
}

export interface MotionQAPayload {
  clipId: string;
  jobId: string;
  clipUrl: string;
  sourceImageUrl: string;
  /** Pan-zoom clips skip Stage 2 vision review entirely — pixel fidelity is guaranteed by construction, not by inspection. */
  renderMode: "ai-motion" | "pan-zoom";
  /** "reel" applies a lower QA-retry ceiling — see qa.ts's MAX_QA_RETRIES_REEL comment. */
  deliverable?: "catalogue" | "reel";
}

export interface MotionComposePayload {
  jobId: string;
  clipIds: string[];
  outputFormat: string;
  duration: number;
}

export interface PresenterRenderPayload {
  jobId: string;
  /** An existing generated on-model photo — see PresenterReelJob's schema comment for why never the raw upload. */
  sourceImageUrl: string;
  script: string;
  /** Rounded to Veo's nearest allowed value (4/6/8) by the worker, same convention as MotionRenderPayload.durationSec. */
  durationSec: number;
  userId: string;
  productId: string;
}
