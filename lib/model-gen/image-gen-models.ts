/**
 * Selectable Gemini image-generation models — internal testing knob.
 *
 * Model-gen (catalogue/quick-listing) has always called a single hardcoded
 * model (GEMINI_MODEL in lib/generate-model-image.ts). This registry lets a
 * retailer pick a different candidate model per generation, so the same
 * product can be A/B'd across models while testing. Try-on (lib/tryon.ts)
 * and the vision/analysis models (metadata extraction, detail notes, AI
 * review) are untouched — this only affects image generation.
 *
 * Cost is picked up automatically: lib/ai-usage/record.ts prices whatever
 * model id actually ran against lib/ai-usage/pricing.ts, so every model here
 * needs a matching PRICES entry to show a real (not "unknown") estimate in
 * /admin/usage.
 *
 * Confirmed against the live ListModels endpoint (2026-08-02) — these four
 * are Google's actual "Nano Banana" image-generation family; every other
 * candidate name floated earlier (plain gemini-3.x-flash variants, and the
 * literal strings "nano-banana-2"/"-pro") either isn't image-capable or
 * isn't a real API model id, so they were dropped rather than kept as
 * silently-broken options.
 */

export type ImageGenModel =
  | "gemini-2.5-flash-image"
  | "gemini-3.1-flash-lite-image"
  | "gemini-3.1-flash-image"
  | "gemini-3-pro-image";

export interface ImageGenModelProfile {
  id: ImageGenModel;
  /** Retailer-facing label. */
  label: string;
}

// Retailer-facing labels — deliberately NOT the provider's internal codenames
// ("Nano Banana" etc.) — those are meaningless jargon to a store owner. Picked
// to avoid colliding with other tier words already in this UI's vocabulary
// (Premium/Economy = provider, Standard/Enhanced = quality, Classic/
// Personalised = casting mode, Signature = casting profiles).
// Only the two models actually under live test are retailer-selectable.
// gemini-2.5-flash-image / gemini-3.1-flash-lite-image stay valid
// ImageGenModel values (real, confirmed API ids) but are deliberately left
// out of this list — no test evidence on them yet, and showing all four
// alongside only two renamed labels read as duplicated, half-finished options.
const IMAGE_GEN_MODEL_PROFILES: ImageGenModelProfile[] = [
  { id: "gemini-3.1-flash-image", label: "Balanced — current default" },
  { id: "gemini-3-pro-image", label: "Fine Detail" },
];

export const DEFAULT_IMAGE_GEN_MODEL: ImageGenModel = "gemini-3.1-flash-image";

/**
 * Whether the model chooser is shown to retailers at all. Default OFF — this
 * is still an internal testing knob (single-sample results aren't enough to
 * commit to a default yet). Flip via Railway env var + redeploy when ready to
 * expose it; no code change needed either way.
 */
export function isImageGenModelChooserEnabled(): boolean {
  return process.env.ENABLE_IMAGE_GEN_MODEL_CHOOSER === "true";
}

const MODEL_IDS = new Set<string>(IMAGE_GEN_MODEL_PROFILES.map((p) => p.id));

export function isImageGenModel(v: unknown): v is ImageGenModel {
  return typeof v === "string" && MODEL_IDS.has(v);
}

export function listImageGenModels(): ImageGenModelProfile[] {
  return IMAGE_GEN_MODEL_PROFILES;
}
