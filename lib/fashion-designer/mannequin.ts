import type { DesignUnderstanding } from "./types";

export type BodyCoverage = "upper" | "lower" | "full";

// Short, upper-body-only single pieces — a half/torso mannequin (or a full
// mannequin cropped at/below the knee) is fine, no need to show legs/feet.
const UPPER_TYPES = new Set(["Shirt", "Kurti", "Sherwani", "Blouse", "Blazer", "Nehru Jacket"]);

// Bottom-only pieces — the top half can be cropped out; the camera should
// focus on the waist-to-feet region where the actual garment is.
const LOWER_TYPES = new Set(["Trouser", "Sharara", "Gharara", "Palazzo", "Salwar", "Lehenga Skirt"]);

// Everything else (Saree, Lehenga, Anarkali, Dupatta, Men Suit, Kurta
// Salwar, Other) needs the complete mannequin visible, no cropping.

/**
 * Which part of the mannequin the generated flat images need to show.
 * Length-sensitive for the upper-body candidates (e.g. a long Kurti still
 * needs the full mannequin visible) — lower and full are fixed by type.
 */
export function resolveBodyCoverage(garmentType: string, design: DesignUnderstanding): BodyCoverage {
  if (LOWER_TYPES.has(garmentType)) return "lower";
  if (UPPER_TYPES.has(garmentType)) {
    const length = (design.length || "").toLowerCase();
    return /long|knee|calf|floor/.test(length) ? "full" : "upper";
  }
  return "full";
}

/** Two-piece combinations (jacket + trouser, etc.) that need a coordinated inner shirt. */
export function isTwoPieceCombination(garmentType: string): boolean {
  return garmentType === "Men Suit";
}
