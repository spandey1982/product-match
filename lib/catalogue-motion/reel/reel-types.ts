/**
 * Ad/Marketing Reel — types local to the reel deliverable.
 *
 * Deliberately separate from lib/catalogue-motion/types.ts's StoryboardShot:
 * a reel shot needs a concept catalogue shots never did — WHICH image a shot
 * should animate (the generated on-model photo, a freshly-cast frame, or the
 * raw original source) — so extending the shared shot type would leak a
 * reel-only concern into the live catalogue-video path for no benefit.
 */
import type { MotionDeliverable, ReelArchetype, ReelPresentation } from "../types";

export type { MotionDeliverable, ReelArchetype, ReelPresentation };

export function isMotionDeliverable(v: unknown): v is MotionDeliverable {
  return v === "catalogue" || v === "reel";
}

export function isReelPresentation(v: unknown): v is ReelPresentation {
  return v === "model" || v === "mannequin";
}

export function isReelArchetype(v: unknown): v is ReelArchetype {
  return v === "showcase-engaging";
}

export const DEFAULT_REEL_ARCHETYPE: ReelArchetype = "showcase-engaging";

/** A shot's role in the reel's hook → journey → close structure (playbook-authoritative order). */
export type ReelShotRole = "hook" | "interaction" | "detail" | "close";

export interface ReelStoryboardShot {
  /** Matches ProductImage.view where relevant (front/back) — informs sourceBase only. */
  view: string;
  label: string;
  presetId: string;
  durationSec: number;
  sourceBase: "front" | "back";
  /** Crop region id (crop-templates.ts), when this shot is a tight crop rather than the full base shot. */
  cropId?: string;
  /** ai-motion (Veo) | pan-zoom (local deterministic FFmpeg). Detail shots are always pan-zoom — see isDetailTruth. */
  renderMode: "ai-motion" | "pan-zoom";
  role: ReelShotRole;
  /**
   * true → this shot's job is fabric/craftsmanship truth (embroidery, weave,
   * border). It ALWAYS animates the raw original source photo, never the
   * generated model/mannequin photo — the generated image isn't a
   * trustworthy source of the product's real surface detail, and this also
   * sidesteps Veo's known embroidery-distortion issue on detail crops (see
   * storyboards.ts's own pan-zoom-for-detail precedent).
   */
  isDetailTruth: boolean;
  /** Extra instruction for the engagement/interaction this shot should show (hand on product, turn, etc.) — see reel-prompt-builder.ts. */
  engagementCue?: string;
  /**
   * A deliberately more conservative fallback cue, used only on the ONE
   * retry a reel clip gets after a QA rejection (MAX_QA_RETRIES_REEL = 1,
   * see workers/qa.ts) — retrying with the identical cue that just failed
   * mostly just re-confirms the same failure at full Veo price (see
   * research/reel-engine-components.html's economics section). Not a
   * rephrasing of the primary cue: strictly safer — moves any hand contact
   * away from the garment's most pattern-dense area, or removes independent
   * motion entirely — since the retry's only goal is to land an accepted
   * clip, not to retry the same creative bet twice.
   */
  engagementCueAlt?: string;
  /**
   * true → this shot must never show the model's face, enforced structurally
   * by cropping to a neck-down frame (reference-resolver.ts), not just by
   * prompt instruction. Live-tested finding (2026-09-06): a back-view "turn to
   * reveal" shot let Veo render a mid-turn face that didn't match the other
   * shots (the front/back generated photos come from independent generations
   * with no shared identity anchor) — cropping the face out of frame entirely
   * removes the failure mode instead of hoping the prompt is obeyed.
   */
  excludeFace?: boolean;
  rationale: string;
}

export interface ReelStoryboard {
  categoryKey: string;
  label: string;
  shots: ReelStoryboardShot[];
}
