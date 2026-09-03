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

// Rewritten after competitor benchmarking (karchobi.in, 2026-09) — every
// reference photo across morning/midday/evening settings shared the same
// three ingredients the previous one-line descriptions lacked: a visible
// rim-light on the hair, a shadow that falls consistently in one direction,
// and (for evening/night) out-of-focus light sources in the background. See
// LIGHTING_CORE in ../prompt-sets.ts for the universal version of this that
// applies regardless of scene; these add the time-of-day-specific character
// on top of it.
const CAMERA_CLAUSE: Record<CameraStyle, string> = {
  morning: "soft, low-angle early-morning sunlight casting a gentle rim-light along the hair and long, soft-edged shadows falling consistently in one direction",
  "golden-hour": "warm, low golden-hour sunlight from behind or to the side of the model, creating a bright glowing rim-light through the hair and along the shoulders, long soft shadows, and a warm golden colour cast over the entire scene",
  "soft-daylight": "even, softly diffused daylight (open shade or a bright overcast sky) that still has a gentle directional quality — a soft catchlight in the eyes and a subtle rim along the hair, never flat or shadowless",
  evening: "warm evening ambient light with gentle golden tones, soft directional shadows, and out-of-focus warm light sources visible in the background",
  night: "cinematic night lighting from warm practical sources such as street lamps, shopfronts or string lights, with soft glowing bokeh circles visible in the background, a warm key light on the face, and cooler ambient light in the shadows",
  "indoor-studio": "soft window light entering from one side or from behind, glowing through sheer fabric or glass, with a gentle rim-light on the hair and a soft falloff into shadow on the far side of the face",
  outdoor: "natural outdoor daylight with clear directional character — a visible highlight side and shadow side, a soft rim along the hair, and shadows that fall consistently in one direction",
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
