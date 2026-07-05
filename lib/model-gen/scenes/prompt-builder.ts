/**
 * Scenic Collection Prompt Builder.
 *
 * Composes a scene + variation + intensity + density + resolved palette
 * accent into ONE deterministic prompt fragment — the Scenic Collection
 * equivalent of `../backdrops.ts#renderBackdropPrompt`. Same contract: pure,
 * no AI call, same input → same string. The result plugs directly into
 * `../prompt-sets.ts#buildViewPrompt`'s `backdrop: string` parameter, so nothing
 * downstream needs to know Scenic Collection exists.
 */
import type { CameraStyle, Scene, SceneDensity, SceneIntensity, SceneVariation } from "./types";
import { buildNegativeClause } from "./negative-prompts";

const CAMERA_CLAUSE: Record<CameraStyle, string> = {
  morning: "soft early-morning natural light",
  "golden-hour": "warm golden-hour sunlight with long soft shadows",
  "soft-daylight": "even, soft natural daylight",
  evening: "warm evening ambient light with gentle golden tones",
  night: "cinematic night lighting with warm practical light sources",
  "indoor-studio": "controlled indoor studio-quality lighting",
  outdoor: "natural outdoor daylight",
};

const INTENSITY_CLAUSE: Record<SceneIntensity, string> = {
  minimal: "The environment should feel very subtle and softly out of focus, staying clearly secondary to the garment",
  balanced: "The environment should be noticeable but restrained, framing the model without competing with the garment",
  editorial: "The environment should read as a magazine-quality, editorial composition, while the garment remains unambiguously the focal point",
};

/** The scene's default camera style (index 0), used until a per-generation picker exists. */
export function defaultCameraStyle(scene: Scene): CameraStyle {
  return scene.cameraStyles[0];
}

function decorClause(variation: SceneVariation, density: SceneDensity): string {
  const items = variation.decor[density];
  if (!items || items.length === 0) return "";
  return `The scene includes ${items.join(", ")}, placed naturally with realistic scale and perspective relative to the model`;
}

export function renderScenePrompt(
  scene: Scene,
  variation: SceneVariation,
  intensity: SceneIntensity,
  density: SceneDensity,
  accentColor: string
): string {
  const camera = defaultCameraStyle(scene);

  return [
    `Set in ${variation.environment}`,
    `Foreground: ${variation.depth.foreground}. Midground: ${variation.depth.midground}. Background: ${variation.depth.background}`,
    `Photographed with ${CAMERA_CLAUSE[camera]}`,
    INTENSITY_CLAUSE[intensity],
    decorClause(variation, density),
    `Environment palette leans on ${accentColor} accents that complement the garment's own colour without competing with it`,
    "High resolution, photorealistic, no secondary insets or fabric swatches — exactly one continuous photograph",
    buildNegativeClause(scene.negativeExtras),
  ]
    .filter(Boolean)
    .join(". ");
}
