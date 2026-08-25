import type { DesignUnderstanding } from "./types";

export type MannequinType = "half" | "full";

// Short, upper-body-only single pieces get the half/torso form. Everything
// else (bottoms, full-length sets, drapes, combinations) needs a full
// mannequin — a half torso form can't display them.
const UPPER_SHORT_CANDIDATES = new Set(["Shirt", "Kurti", "Sherwani", "Blouse"]);

/**
 * Which mannequin form the generated flat images should be presented on.
 * Length-sensitive for the short-upper-piece candidates (e.g. a long Kurti
 * still needs a full mannequin) — everything else is a fixed full mannequin.
 */
export function resolveMannequinType(garmentType: string, design: DesignUnderstanding): MannequinType {
  if (!UPPER_SHORT_CANDIDATES.has(garmentType)) return "full";
  const length = (design.length || "").toLowerCase();
  return /long|knee|calf|floor/.test(length) ? "full" : "half";
}

/** Two-piece combinations (jacket + trouser, etc.) that need a coordinated inner shirt. */
export function isTwoPieceCombination(garmentType: string): boolean {
  return garmentType === "Men Suit";
}
