import type { FabricAnalysis, DesignUnderstanding } from "./types";

/**
 * Composes a descriptive design title from already-extracted analysis
 * fields — the same fields add-to-catalog/route.ts already uses to compose
 * the catalog product's description — so no extra AI call is needed.
 * e.g. "Maroon Floral Embroidered Silk Kurti".
 */
export function composeDesignTitle(
  garmentType: string,
  fabric: FabricAnalysis,
  design: DesignUnderstanding
): string {
  const parts = [
    fabric.color,
    fabric.pattern && fabric.pattern !== "Unknown" ? fabric.pattern : null,
    design.embroidery && design.embroidery !== "None" ? "Embroidered" : null,
    fabric.fabricType && fabric.fabricType !== "Unknown" ? fabric.fabricType : null,
    garmentType,
  ].filter((p): p is string => !!p);

  return parts.join(" ");
}
