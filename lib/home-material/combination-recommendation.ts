/**
 * Combination Recommendations — sub-problem F from the 2026-09-09
 * multi-wall discussion, built 2026-09-10 after a dedicated scoping
 * conversation ("both" same-wall layered combos AND cross-wall room
 * combos). Same architectural level as lib/home-material/recommendation.ts
 * (taxonomy-level, deterministic, explainable) — this file only adds
 * CATEGORY-PAIRING rules on top of that existing scorer, it does not
 * re-score materials itself.
 *
 * Deliberately taxonomy-level, not actual-product/color-level: HmProduct
 * does carry colorHex for real swatches, but building a genuine
 * color-harmony algorithm here would (a) duplicate real complexity the
 * fashion side's lib/matching-engine/color-harmony.ts already owns as
 * protected IP for a different domain, and (b) go beyond what was asked —
 * this stays at the same "which material TYPES combine well" level the
 * existing recommendation engine already operates at. If real per-product
 * color matching is wanted later, that's a deliberate follow-up, not
 * assumed here.
 *
 * Ephemeral by design: unlike lib/home-material/recommendation.ts's
 * single-material picks (persisted to HmRecommendation so a page reload
 * doesn't lose them), combination results are computed fresh on every
 * call and never persisted — no schema change needed for this pass, and
 * combos are cheap enough to recompute. Revisit if the user wants combo
 * shortlisting/history later.
 */
import type { MaterialCategory } from "./material-taxonomy";
import { MATERIAL_TAXONOMY } from "./material-taxonomy";
import { scoreMaterial, type MaterialRecommendationResult, type MaterialRequirements } from "./recommendation";

const ALL_CATEGORIES: MaterialCategory[] = ["paint", "wallpaper", "wall_texture", "wall_panel"];

function pairKey(a: MaterialCategory, b: MaterialCategory): string {
  return [a, b].sort().join("+");
}

/**
 * Which category PAIRS make sense applied together on ONE wall, and how
 * ("role"). Deliberately excludes any pair not listed here (e.g.
 * wallpaper+wall_texture — two full-coverage patterned/textured
 * treatments on one wall reads as visually busy, not a recommendable
 * combo) — never surface a combination this table doesn't vouch for.
 */
const SAME_WALL_PAIRS: Record<string, { level: "high" | "medium"; role: string }> = {
  [pairKey("paint", "wall_panel")]: {
    level: "high",
    role: "Wall panel (wainscoting) on the lower portion, paint above — a classic, widely-used layered treatment.",
  },
  [pairKey("wall_panel", "wallpaper")]: {
    level: "high",
    role: "Wall panel (wainscoting) on the lower portion, wallpaper above — adds pattern without covering the whole wall in panelling.",
  },
  [pairKey("paint", "wall_texture")]: {
    level: "medium",
    role: "Paint as the main surface with a textured finish on one accent band or alcove.",
  },
  [pairKey("paint", "wallpaper")]: {
    level: "medium",
    role: "Paint on most of the wall, wallpaper as a lower accent band below a chair rail (or the reverse).",
  },
  [pairKey("wall_panel", "wall_texture")]: {
    level: "medium",
    role: "Textured finish on the main surface, wall panel on a lower band or alcove.",
  },
};

function bestForCategory(category: MaterialCategory, requirements: MaterialRequirements): MaterialRecommendationResult | null {
  const entries = MATERIAL_TAXONOMY.filter((e) => e.category === category);
  if (entries.length === 0) return null;
  return entries.map((e) => scoreMaterial(e, requirements)).sort((a, b) => b.score - a.score)[0];
}

export interface SameWallCombination {
  categories: [MaterialCategory, MaterialCategory];
  materials: [MaterialRecommendationResult, MaterialRecommendationResult];
  compatibility: "high" | "medium";
  role: string;
  score: number;
  explanation: string;
}

/** Same-wall layered combos (e.g. paint + wainscoting) for a SINGLE wall. */
export function generateSameWallCombinations(requirements: MaterialRequirements, limit = 4): SameWallCombination[] {
  const results: SameWallCombination[] = [];

  for (let i = 0; i < ALL_CATEGORIES.length; i++) {
    for (let j = i + 1; j < ALL_CATEGORIES.length; j++) {
      const catA = ALL_CATEGORIES[i];
      const catB = ALL_CATEGORIES[j];
      const compat = SAME_WALL_PAIRS[pairKey(catA, catB)];
      if (!compat) continue;

      const bestA = bestForCategory(catA, requirements);
      const bestB = bestForCategory(catB, requirements);
      if (!bestA || !bestB) continue;

      const score = Math.round(((bestA.score + bestB.score) / 2) * 100) / 100;
      results.push({
        categories: [catA, catB],
        materials: [bestA, bestB],
        compatibility: compat.level,
        role: compat.role,
        score,
        explanation: `${compat.role} Suggested: ${bestA.name} + ${bestB.name}.`,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface RoomScheme {
  featureWall: MaterialRecommendationResult;
  surroundingWalls: MaterialRecommendationResult;
  explanation: string;
}

/**
 * Cross-wall ROOM combo: one "feature wall" gets a bolder pattern/texture
 * material, the rest of the room's walls get a complementary paint — the
 * standard feature-wall convention. Requires 2+ confirmed walls in the
 * room to mean anything (a single wall has no "surrounding walls").
 */
export function generateRoomScheme(requirements: MaterialRequirements, wallCount: number): RoomScheme | null {
  if (wallCount < 2) return null;

  const boldBest = (["wallpaper", "wall_texture"] as const)
    .map((c) => bestForCategory(c, requirements))
    .filter((r): r is MaterialRecommendationResult => r !== null)
    .sort((a, b) => b.score - a.score)[0];
  const paintBest = bestForCategory("paint", requirements);
  if (!boldBest || !paintBest) return null;

  const otherCount = wallCount - 1;
  return {
    featureWall: boldBest,
    surroundingWalls: paintBest,
    explanation: `Make one wall the feature with ${boldBest.name} (${boldBest.category.replace("_", " ")}), and paint the remaining ${otherCount} wall${
      otherCount === 1 ? "" : "s"
    } with ${paintBest.name} as a calm surround — keeps the room from feeling visually busy while still giving it a focal point.`,
  };
}
