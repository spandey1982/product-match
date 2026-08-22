/**
 * Motion provider abstraction — mirrors lib/providers/types.ts (TryOnProvider).
 *
 * Each implementation is a thin adapter over one video-generation API.
 * Providers do not know about storyboards, storage, or billing — the
 * orchestrator handles all of that. New providers plug in without touching
 * call sites; the orchestrator resolves them through the factory in ./index.
 */
import type { MotionIntensity, MotionConstraints } from "../types";
import type { ClipInstruction } from "../prompt-builder";

export type MotionProviderId = "veo" | "kling";

export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClipRenderInput {
  /** The existing catalogue image (or crop) to animate — never a new generation. */
  sourceImageUrl: string;
  instruction: ClipInstruction;
  intensity: MotionIntensity;
  constraints: MotionConstraints;
  durationSec: number;
  /** Present when animating a close-up region — informs output framing. */
  cropRegion?: CropRegion;
}

export interface ClipRenderResult {
  /** URL of the rendered clip (uploaded to Cloudinary by the caller, not the provider). */
  videoBase64: string;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
  costUsd: number | null;
  provider: MotionProviderId;
  model: string;
  /** Raw token/usage counters for AI usage recording, provider-specific shape. */
  usage?: Record<string, unknown>;
}

export interface MotionProvider {
  readonly id: MotionProviderId;
  readonly label: string;
  readonly maxDurationSec: number;
  /** Whether this provider is usable in the current environment (flags + credentials). Never throws. */
  isEnabled(): boolean;
  /** Best-effort cost estimate in USD for a clip of the given duration. Null when unknown. */
  estimateCost(durationSec: number): number | null;
  /** Render one clip. Throws on failure — the orchestrator maps errors to clip status. */
  generateClip(input: ClipRenderInput): Promise<ClipRenderResult>;
}
