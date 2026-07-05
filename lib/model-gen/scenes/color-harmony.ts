/**
 * Smart Colour Harmony for scenes — deterministic, no AI call.
 *
 * Reuses the same core IP as `../backdrop-match.ts`: `getColorCompatibility`
 * from lib/matching-engine/color-harmony. A scene's palette offers several
 * candidate accent colour families; this picks the one that best complements
 * the garment (and steers away from the scene's `avoid` list, e.g. a deep-red
 * bridal outfit doesn't get a red-dominated Wedding accent) so the garment
 * always stands out against its scene.
 */
import { getColorCompatibility } from "@/lib/matching-engine/color-harmony";
import type { Scene } from "./types";

/** Resolve the best-fit accent colour family from the scene's palette for this garment. */
export function resolvePaletteAccent(scene: Scene, garmentColor: string | null | undefined): string {
  const garment = (garmentColor ?? "").trim();
  const candidates = scene.palette.accent.filter((a) => !scene.palette.avoid.includes(a));
  const pool = candidates.length > 0 ? candidates : scene.palette.accent;

  if (!garment) return pool[0] ?? scene.palette.base[0];

  let best = pool[0] ?? scene.palette.base[0];
  let bestScore = -1;
  for (const accent of pool) {
    const { score, type } = getColorCompatibility(garment, accent);
    // Tonal (too-similar) accents are deprioritised — they'd camouflage the garment.
    const adjusted = type === "tonal" ? score - 0.3 : score;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = accent;
    }
  }
  return best;
}
