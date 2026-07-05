/**
 * A retailer's stored Scenic Collection choice — mirrors
 * `../backdrops.ts`'s `BackdropSelection` (same shape/validation pattern).
 */
import { DEFAULT_SCENE_ID, isSceneId } from "./library";
import type { SceneDensity, SceneIntensity } from "./types";

export interface ScenicSelection {
  sceneId: string;
  intensity: SceneIntensity;
  density: SceneDensity;
}

export const DEFAULT_SCENIC_SELECTION: ScenicSelection = {
  sceneId: DEFAULT_SCENE_ID,
  intensity: "balanced",
  density: "classic",
};

export function isSceneIntensity(v: unknown): v is SceneIntensity {
  return v === "minimal" || v === "balanced" || v === "editorial";
}

export function isSceneDensity(v: unknown): v is SceneDensity {
  return v === "minimal" || v === "classic" || v === "rich";
}

export function isScenicSelection(v: unknown): v is ScenicSelection {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return isSceneId(o.sceneId) && isSceneIntensity(o.intensity) && isSceneDensity(o.density);
}

/** Parse an unknown into a valid selection, repairing/defaulting any bad field. */
export function parseScenicSelection(raw: unknown): ScenicSelection {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      sceneId: isSceneId(o.sceneId) ? o.sceneId : DEFAULT_SCENIC_SELECTION.sceneId,
      intensity: isSceneIntensity(o.intensity) ? o.intensity : DEFAULT_SCENIC_SELECTION.intensity,
      density: isSceneDensity(o.density) ? o.density : DEFAULT_SCENIC_SELECTION.density,
    };
  }
  return { ...DEFAULT_SCENIC_SELECTION };
}

/** Which top-level backdrop section a retailer's generation uses. */
export type BackdropSection = "studio" | "scenic";

export function isBackdropSection(v: unknown): v is BackdropSection {
  return v === "studio" || v === "scenic";
}
