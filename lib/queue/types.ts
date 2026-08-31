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
};

export interface MotionRenderPayload {
  clipId: string;
  jobId: string;
  sourceImageUrl: string;
  presetId: string;
  /** Extra garment-motion instruction from the director's plan, if any (see DirectorShotPlan.motionEmphasis). */
  motionEmphasis?: string;
  intensity: string;
  /** The director's planned on-screen hold — Veo rounds this up to its nearest allowed generation length. */
  durationSec: number;
  cropRegion?: { x: number; y: number; w: number; h: number };
}

export interface MotionQAPayload {
  clipId: string;
  jobId: string;
  clipUrl: string;
  sourceImageUrl: string;
}

export interface MotionComposePayload {
  jobId: string;
  clipIds: string[];
  outputFormat: string;
  duration: number;
}
