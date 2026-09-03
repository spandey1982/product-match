/**
 * Catalogue Motion Grammar — the closed vocabulary of camera movements.
 *
 * Every motion video selects from this preset library. No free-form
 * prompting is exposed. Storyboards compose presets into shot sequences;
 * the prompt builder translates each preset into a provider-specific
 * camera control instruction.
 */
import type { MotionPreset } from "./types";

export const MOTION_PRESETS: Record<string, MotionPreset> = {
  "slow-push-in": {
    id: "slow-push-in",
    label: "Slow Push In",
    type: "dolly",
    description: "Gradual forward dolly toward the subject center",
    durationRange: { min: 2, max: 3 },
    incompatible: ["slow-pull-out", "macro-push"],
  },
  "slow-pull-out": {
    id: "slow-pull-out",
    label: "Slow Pull Out",
    type: "dolly",
    description: "Backward dolly revealing the full frame",
    durationRange: { min: 2, max: 3 },
    incompatible: ["slow-push-in"],
  },
  "slight-orbit": {
    id: "slight-orbit",
    label: "Slight Orbit",
    type: "orbit",
    description: "3–8° arc around the subject",
    durationRange: { min: 2, max: 3 },
    incompatible: ["horizontal-slide", "diagonal-slide", "tilt-up", "tilt-down", "perspective-shift"],
  },
  "tilt-up": {
    id: "tilt-up",
    label: "Tilt Up",
    type: "pan",
    description: "Vertical pan from lower body to upper body",
    durationRange: { min: 1.5, max: 2.5 },
    incompatible: ["tilt-down", "slight-orbit"],
  },
  "tilt-down": {
    id: "tilt-down",
    label: "Tilt Down",
    type: "pan",
    description: "Vertical pan from upper body to lower body",
    durationRange: { min: 1.5, max: 2.5 },
    incompatible: ["tilt-up", "slight-orbit"],
  },
  "horizontal-slide": {
    id: "horizontal-slide",
    label: "Horizontal Slide",
    type: "track",
    description: "Lateral tracking shot",
    durationRange: { min: 1, max: 2 },
    incompatible: ["slight-orbit", "cinematic-drift"],
  },
  "diagonal-slide": {
    id: "diagonal-slide",
    label: "Diagonal Slide",
    type: "track",
    description: "Combined lateral and vertical tracking",
    durationRange: { min: 1, max: 2 },
    incompatible: ["slight-orbit", "cinematic-drift"],
  },
  "macro-push": {
    id: "macro-push",
    label: "Macro Push",
    type: "zoom",
    description: "Tight forward zoom into fabric texture or detail",
    durationRange: { min: 1, max: 1.5 },
    incompatible: ["slow-push-in", "slow-pull-out"],
  },
  "detail-reveal": {
    id: "detail-reveal",
    label: "Detail Reveal",
    type: "zoom",
    description: "Starts tight on detail, widens to show context",
    durationRange: { min: 1.5, max: 2 },
    incompatible: ["slow-push-in"],
  },
  "perspective-shift": {
    id: "perspective-shift",
    label: "Perspective Shift",
    type: "parallax",
    description: "Subtle viewing angle change creating parallax",
    durationRange: { min: 2, max: 3 },
    incompatible: ["slight-orbit"],
  },
  "breathing-hold": {
    id: "breathing-hold",
    label: "Breathing Hold",
    type: "static",
    description: "Static camera with ambient micro-motion only",
    durationRange: { min: 1, max: 2 },
    incompatible: [],
  },
  "cinematic-drift": {
    id: "cinematic-drift",
    label: "Cinematic Drift",
    type: "track",
    description: "Barely perceptible lateral movement",
    durationRange: { min: 2, max: 3 },
    incompatible: ["horizontal-slide", "diagonal-slide"],
  },
};

export function resolvePreset(id: string): MotionPreset | undefined {
  return MOTION_PRESETS[id];
}

export function listPresets(): MotionPreset[] {
  return Object.values(MOTION_PRESETS);
}
