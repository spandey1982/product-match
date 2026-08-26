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

// ── Output ──────────────────────────────────────────────────────────────────

/**
 * Total video duration. Superseded from the original spec's arbitrary 5/7/10s
 * once Veo's real constraint (every ai-motion shot bills a 4/6/8s floor) was
 * confirmed live — a storyboard's total is now always shot-count x 4s, so the
 * only durations that don't waste billed seconds are multiples of 4.
 */
export type OutputDuration = 12 | 16 | 20;

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
