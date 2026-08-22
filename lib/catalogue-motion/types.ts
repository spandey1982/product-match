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

export type OutputDuration = 5 | 7 | 10;

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
