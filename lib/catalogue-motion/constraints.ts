/**
 * Motion intensity → constraint parameter mapping.
 *
 * Retailers pick one of three intensity levels. The system maps each level
 * to concrete numeric limits that bound what the AI provider may attempt.
 * These values are passed to the prompt builder and also used by the QA
 * pipeline to verify the rendered clip stayed within bounds.
 */
import type { MotionIntensity, MotionConstraints } from "./types";

const INTENSITY_MAP: Record<MotionIntensity, MotionConstraints> = {
  minimal: {
    cameraMagnitude: 0.03,
    maxZoom: 1.05,
    maxOrbitDeg: 2,
    maxPanSpeed: 15,
    maxZoomSpeed: 0.02,
    ambientMotion: 0.01,
  },
  elegant: {
    cameraMagnitude: 0.06,
    maxZoom: 1.15,
    maxOrbitDeg: 5,
    maxPanSpeed: 30,
    maxZoomSpeed: 0.04,
    ambientMotion: 0.03,
  },
  dynamic: {
    cameraMagnitude: 0.10,
    maxZoom: 1.25,
    maxOrbitDeg: 8,
    maxPanSpeed: 50,
    maxZoomSpeed: 0.06,
    ambientMotion: 0.05,
  },
};

export function constraintsFor(intensity: MotionIntensity): MotionConstraints {
  return INTENSITY_MAP[intensity];
}

export function isMotionIntensity(v: unknown): v is MotionIntensity {
  return v === "minimal" || v === "elegant" || v === "dynamic";
}

export const DEFAULT_INTENSITY: MotionIntensity = "elegant";

export const OUTPUT_FORMATS = [
  { id: "website", label: "Website", width: 1080, height: 1440 },
  { id: "ig-story", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "ig-feed", label: "Instagram Feed", width: 1080, height: 1350 },
  { id: "marketplace", label: "Marketplace (3:4)", width: 1080, height: 1440 },
] as const;

export type OutputFormatId = (typeof OUTPUT_FORMATS)[number]["id"];
