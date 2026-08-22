/**
 * Deterministic prompt construction for motion clip rendering.
 *
 * Retailers never author prompts — every preset + intensity combination maps
 * to a fixed, reviewed camera-instruction template. The same inputs always
 * produce the same instruction text, so output quality is a function of the
 * grammar/storyboard data, not of prompt-engineering skill. A universal
 * constraint suffix (see MOTION_CONSTRAINTS_SPEC) is appended to every clip,
 * encoding the "camera moves, model stays still" rules from the architecture
 * spec directly into the instruction the provider receives.
 */
import type { MotionPreset, MotionConstraints, MotionIntensity } from "./types";

const INTENSITY_DESCRIPTOR: Record<MotionIntensity, string> = {
  minimal: "extremely subtle, barely perceptible",
  elegant: "gentle and elegant",
  dynamic: "noticeable but still refined and controlled",
};

/** Per-preset camera instruction template. Takes the intensity descriptor. */
const CAMERA_TEMPLATES: Record<string, (mag: string) => string> = {
  "slow-push-in": (mag) =>
    `A ${mag} slow forward camera dolly, moving smoothly and continuously toward the subject's center of mass. No cuts, no acceleration changes.`,
  "slow-pull-out": (mag) =>
    `A ${mag} slow backward camera dolly, moving smoothly away from the subject to reveal the full frame. No cuts, no acceleration changes.`,
  "slight-orbit": (mag) =>
    `A ${mag} slow orbital camera movement arcing around the subject by a few degrees, maintaining constant distance and framing.`,
  "tilt-up": (mag) =>
    `A ${mag} slow vertical camera pan moving from the lower body upward to the upper body, at constant speed.`,
  "tilt-down": (mag) =>
    `A ${mag} slow vertical camera pan moving from the upper body downward to the lower body, at constant speed.`,
  "horizontal-slide": (mag) =>
    `A ${mag} slow lateral camera tracking movement, sliding sideways at constant height and distance.`,
  "diagonal-slide": (mag) =>
    `A ${mag} slow diagonal camera tracking movement, combining lateral and vertical motion at constant speed.`,
  "macro-push": (mag) =>
    `A ${mag} tight forward zoom into fabric texture and surface detail, revealing weave and craftsmanship without distortion.`,
  "detail-reveal": (mag) =>
    `A ${mag} slow zoom-out starting tight on a detail and widening to reveal surrounding context, at constant speed.`,
  "perspective-shift": (mag) =>
    `A ${mag} subtle change in camera viewing angle creating gentle parallax between foreground and background, no rotation.`,
  "breathing-hold": () =>
    `A completely static camera. No camera movement of any kind.`,
  "cinematic-drift": (mag) =>
    `A ${mag}, barely perceptible lateral camera drift, slower and subtler than a standard tracking shot.`,
};

/**
 * Universal constraints appended to every clip instruction, regardless of
 * preset — encodes the "never move" / "rarely move" / "allowed" rules from
 * the Motion Constraints spec directly into the render request.
 */
const UNIVERSAL_CONSTRAINTS =
  "The subject's face, hands, and pose remain completely static throughout: " +
  "no facial movement, no blinking or expression change, no hand gestures, " +
  "no walking, no head turns, no arm movement. Only imperceptible ambient " +
  "motion is allowed (gentle breathing, a barely visible fabric sway from " +
  "indoor air). The garment must not distort, morph, stretch, or change " +
  "color or pattern. The background and studio lighting remain completely " +
  "fixed and unchanged — no new elements, no color drift, no shadow " +
  "movement. No camera shake, no jitter, no handheld feel.";

export interface ClipInstruction {
  /** The full text instruction sent to the provider alongside the source image. */
  text: string;
  /** Structured parameters for QA verification and provider-native camera controls, when supported. */
  params: {
    presetId: string;
    intensity: MotionIntensity;
    durationSec: number;
    cameraMagnitude: number;
    maxZoom: number;
    maxOrbitDeg: number;
  };
}

export function buildClipInstruction(
  preset: MotionPreset,
  intensity: MotionIntensity,
  constraints: MotionConstraints,
  durationSec: number,
): ClipInstruction {
  const template = CAMERA_TEMPLATES[preset.id];
  if (!template) {
    throw new Error(`No prompt template registered for preset "${preset.id}"`);
  }

  const magnitude = INTENSITY_DESCRIPTOR[intensity];
  const cameraLine = template(magnitude);
  const text = `${cameraLine} ${UNIVERSAL_CONSTRAINTS} Duration: ${durationSec} seconds.`;

  return {
    text,
    params: {
      presetId: preset.id,
      intensity,
      durationSec,
      cameraMagnitude: constraints.cameraMagnitude,
      maxZoom: constraints.maxZoom,
      maxOrbitDeg: constraints.maxOrbitDeg,
    },
  };
}
