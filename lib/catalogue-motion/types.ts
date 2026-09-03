/**
 * Catalogue Motion — core types.
 *
 * Framework-independent. No Next.js or Prisma imports. These types are the
 * contract between storyboards, grammar, constraints, the orchestrator, and
 * the provider abstraction layer.
 */

// ── Motion Presets ──────────────────────────────────────────────────────────

export type CameraMovementType =
  | "dolly"
  | "pan"
  | "track"
  | "zoom"
  | "orbit"
  | "parallax"
  | "static";

export interface MotionPreset {
  id: string;
  label: string;
  type: CameraMovementType;
  description: string;
  durationRange: { min: number; max: number };
  incompatible: string[];
}

// ── Storyboards ─────────────────────────────────────────────────────────────

/**
 * How a shot's motion is produced:
 *   ai-motion → sent to a MotionProvider (Veo/Kling) as a real generation
 *     call, at Veo's 4s duration floor (see constraints.ts). Used for every
 *     shot in garment-on-model categories (saree, lehenga, kurti, shirt,
 *     dress, jacket, trouser) — a full base shot OR a tight crop on one
 *     region (blouse, pallu, pleats, collar…), always with the model's face/
 *     hands/pose held static per the universal prompt constraints, but real
 *     camera movement and (for the one shot per category where it's the
 *     actual subject) a little garment motion.
 *   pan-zoom → rendered locally via a deterministic FFmpeg crop/zoom of the
 *     static source image (a Ken Burns–style move driven by the same preset
 *     vocabulary). Zero AI cost, no duration floor. Used for every shot in
 *     object-only categories (footwear, handbags, jewellery, dupatta,
 *     accessories) — there's no model to animate, so AI motion adds nothing
 *     a deterministic camera move doesn't already give for free.
 */
export type ShotRenderMode = "ai-motion" | "pan-zoom";

export interface StoryboardShot {
  /** Matches ProductImage.view (front, back, blouse, pallu…). */
  view: string;
  label: string;
  presetId: string;
  durationSec: number;
  /** Which base catalogue shot this derives from (for source resolution). */
  sourceBase: "front" | "back";
  /** Optional crop region id from crop-templates.ts. */
  cropId?: string;
  renderMode: ShotRenderMode;
  /**
   * Extra instruction appended to this shot's prompt on top of the preset's
   * camera-movement line and the universal constraints — for the rare shot
   * where garment motion (not just camera motion) is the actual subject,
   * e.g. "let the pallu settle/sway gently". Omitted for every other shot,
   * which relies on the universal ambient-motion line alone. Ignored by
   * pan-zoom shots (no AI call, nothing to instruct).
   */
  motionEmphasis?: string;
  rationale: string;
}

export interface Storyboard {
  categoryKey: string;
  label: string;
  shots: StoryboardShot[];
  totalDurationSec: number;
}

// ── Intensity ───────────────────────────────────────────────────────────────

export type MotionIntensity = "minimal" | "elegant" | "dynamic";

export interface MotionConstraints {
  /** Camera motion magnitude as fraction (0–1). */
  cameraMagnitude: number;
  /** Zoom range: [1.0, maxZoom]. */
  maxZoom: number;
  /** Maximum orbit arc in degrees. */
  maxOrbitDeg: number;
  /** Maximum pan speed in px/s at 1080p. */
  maxPanSpeed: number;
  /** Maximum zoom speed in ×/s. */
  maxZoomSpeed: number;
  /** Ambient body micro-motion as fraction (0–1). */
  ambientMotion: number;
}

// ── Director plan ───────────────────────────────────────────────────────────

/**
 * One shot's edit decision, as chosen by the creative-director agent
 * (lib/catalogue-motion/agents/directorAgent.ts) from a storyboard's
 * available shot menu. `holdDurationSec` is the actual final on-screen
 * duration — a free float, NOT one of Veo's allowed generation durations.
 * Veo still only ever generates at its 4/6/8s floor (nearest allowed value
 * >= holdDurationSec); the compose worker trims the generated clip down to
 * holdDurationSec. Always clamp to [0.5, 8] in code after parsing the
 * director's JSON response — never trust the raw number, same reason no
 * agent in this codebase trusts free-text-instructed LLM JSON to self-enforce
 * a hard limit. 8 is Veo's real ceiling: trimming can only shrink a
 * generated clip, never lengthen it.
 */
export interface DirectorShotPlan {
  /** Matches a StoryboardShot.view from the resolved storyboard. */
  view: string;
  /** May override the storyboard shot's default preset. */
  presetId: string;
  /** May override/add to the storyboard shot's default motionEmphasis. */
  motionEmphasis?: string;
  holdDurationSec: number;
  /** Marks the opening beat — per research, this should be motion/reveal-led, not a static establish. */
  isHook: boolean;
  rationale: string;
}

export interface DirectorPlan {
  shots: DirectorShotPlan[];
}

// ── Output ──────────────────────────────────────────────────────────────────

export interface OutputFormat {
  id: string;
  label: string;
  width: number;
  height: number;
}

// ── Transitions ─────────────────────────────────────────────────────────────

export type TransitionType = "cut" | "crossfade";

export interface Transition {
  type: TransitionType;
  durationMs: number;
}

// ── Job status ──────────────────────────────────────────────────────────────

export type MotionJobStatus =
  | "queued"
  | "rendering"
  | "composing"
  | "qa"
  | "complete"
  | "failed";

export type MotionClipStatus =
  | "queued"
  | "rendering"
  | "qa"
  | "accepted"
  | "rejected"
  | "failed";

export type QAVerdict = "accepted" | "rejected" | "manual_review";
