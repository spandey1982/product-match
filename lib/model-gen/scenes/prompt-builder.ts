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

/**
 * Foreground-prop compositing rule — added after direct user review of a
 * live Street Style render (2026-09): the evening-city-street variation's
 * foreground street lamp sat close to the camera, roughly in the direct
 * camera-to-model sightline, and competed with the model for attention —
 * worse still, it wasn't blurred enough for how close it read as being,
 * breaking the optical logic of shallow depth of field (closer to the
 * camera should mean MORE defocus, not less). The café-patio render, by
 * contrast, placed its foreground plant off to one side, appropriately
 * blurred, adding atmosphere without stealing focus — the same standard
 * every foreground element must meet from here on.
 *
 * Tightened after a second review (2026-09) of a cafe-patio render: a
 * planter off to one side, out of the camera-model sightline, still ended
 * up covering roughly a quarter of the frame and pulling attention away
 * from the model. Root cause — defocus optically *enlarges* an element's
 * footprint, so "off to the side and blurred" alone isn't sufficient; a
 * small object close to the camera can still spread into a dominant shape.
 * The user drew a clear line using the same image's other props (a chair
 * and a stone planter) as the acceptable reference: those sit ahead of the
 * model on her own depth line rather than near the camera, are only
 * partially inside the frame, and read as modest, comparable in scale to
 * each other — never a single element ballooning to hog the frame. Added
 * an explicit frame-share cap to make that distinction concrete rather
 * than relying on "modest" alone.
 */
const FOREGROUND_RULE =
  "Foreground element placement (mandatory): any element positioned directly between the camera and the model — anywhere in the camera-to-model sightline — is not allowed, no matter how blurred it is, and no element may overlap the model's face, body or the garment. An element that sits ahead of the model on her own depth line rather than close to the camera is fine even when only partially inside the frame, as long as it stays modest and comparable in scale to the scene's other environmental elements (like a chair or planter she is standing near) and never pulls the eye away from her. Anything genuinely close to the camera must be kept small to begin with, not just softly out of focus — defocus optically enlarges an element's footprint, so a small close object can still spread into a large, attention-grabbing shape; proximity to the camera is never an excuse for a prop to dominate a corner of the frame. As a hard guide, no single foreground or midground element should cover more than roughly 10% of the frame's area.";

export function renderScenePrompt(
  scene: Scene,
  variation: SceneVariation,
  intensity: SceneIntensity,
  density: SceneDensity,
  accentColor: string
): string {
  const camera = variation.cameraStyle ?? defaultCameraStyle(scene);

  return [
    `Set in ${variation.environment}`,
    `Foreground: ${variation.depth.foreground}. Midground: ${variation.depth.midground}. Background: ${variation.depth.background}`,
    FOREGROUND_RULE,
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
