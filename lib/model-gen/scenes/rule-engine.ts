/**
 * Scenic Collection rule engine — deterministic, no AI call.
 *
 * Two responsibilities, both pure functions of product signals:
 *  1. Pick which curated variation of a scene to render (`selectSceneVariation`).
 *  2. Recommend which scenes suit a product (`recommendScenes`), mirroring
 *     `lib/providers/auto-routing.ts`'s table-driven category routing.
 */
import { SCENES } from "./library";
import type { Scene, SceneVariation } from "./types";

export interface SceneSignals {
  category?: string | null;
  color?: string | null;
  pattern?: string | null;
  /** Product.occasion / styleTags / season — parsed JSON arrays (lib/serialize.ts). */
  occasion?: string[] | null;
  styleTags?: string[] | null;
  season?: string[] | null;
}

/**
 * Stable, deterministic index derived from product signals — same product
 * always resolves to the same variation, different products spread across
 * the pool, satisfying "every generation has its own identity" without ever
 * being random (regeneration stays consistent for the same product).
 */
function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

/** Resolve which curated variation to render for this scene + product. */
export function selectSceneVariation(scene: Scene, signals: SceneSignals): SceneVariation {
  if (scene.variations.length <= 1) return scene.variations[0];
  const seed = [signals.category, signals.color, signals.pattern].filter(Boolean).join("|");
  const index = stableIndex(seed || scene.id, scene.variations.length);
  return scene.variations[index];
}

export interface SceneRecommendation {
  scene: Scene;
  score: number;
  reason: string;
}

const OCCASION_WEIGHT = 2;
const STYLE_TAG_WEIGHT = 1;
const SEASON_WEIGHT = 1;

/**
 * Score every scene against a product's metadata (occasion/styleTags/season —
 * the same enums lib/metadata/analyze.ts extracts) and return the ranked list.
 * Only scenes with score > 0 are meaningful recommendations; the UI shows a
 * "Suggested" tag on the top pick(s) only.
 */
export function recommendScenes(signals: SceneSignals): SceneRecommendation[] {
  const occasion = new Set((signals.occasion ?? []).map((v) => v.toLowerCase()));
  const styleTags = new Set((signals.styleTags ?? []).map((v) => v.toLowerCase()));
  const season = new Set((signals.season ?? []).map((v) => v.toLowerCase()));

  const scored = SCENES.map((scene) => {
    let score = 0;
    const reasons: string[] = [];

    for (const o of scene.recommendFor.occasion ?? []) {
      if (occasion.has(o.toLowerCase())) {
        score += OCCASION_WEIGHT;
        reasons.push(o);
      }
    }
    for (const t of scene.recommendFor.styleTags ?? []) {
      if (styleTags.has(t.toLowerCase())) {
        score += STYLE_TAG_WEIGHT;
        reasons.push(t);
      }
    }
    for (const s of scene.recommendFor.season ?? []) {
      if (season.has(s.toLowerCase())) {
        score += SEASON_WEIGHT;
        reasons.push(s);
      }
    }

    const reason = reasons.length > 0 ? `Matches ${reasons.slice(0, 2).join(", ")}` : "";
    return { scene, score, reason };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}
