/**
 * Typed accessor for the retailer's AI Generation settings.
 *
 * Stored as a single nullable JSON string in User.aiGenSettings (one column →
 * no migration as the surface grows; see docs/IMAGE_AI_ROADMAP.md §8). Never
 * parse that column inline — always go through here so validation and defaults
 * are applied consistently.
 */
import { db } from "@/lib/db";
import {
  DEFAULT_MODEL_TYPE,
  isModelType,
  type ModelType,
} from "./reference-models";
import {
  DEFAULT_OBJECTIVE,
  isGenerationObjective,
  type GenerationObjective,
} from "./objectives";
import {
  DEFAULT_BACKDROP_SELECTION,
  parseBackdropSelection,
  type BackdropSelection,
} from "./backdrops";
import {
  DEFAULT_SCENIC_SELECTION,
  parseScenicSelection,
  type ScenicSelection,
} from "./scenes/selection";
import {
  DEFAULT_GENERATION_QUALITY,
  isGenerationQuality,
  type GenerationQuality,
} from "./quality";

/** Where the brand watermark sits on generated model images. */
export type BrandingPosition = "top-left" | "top-right";

export function isBrandingPosition(v: unknown): v is BrandingPosition {
  return v === "top-left" || v === "top-right";
}

/**
 * Watermark look: "classic" = the refined adaptive text wordmark; "glass" = the
 * wordmark on a translucent frosted-glass chip. Retailer choice.
 */
export type BrandingStyle = "classic" | "glass";

export function isBrandingStyle(v: unknown): v is BrandingStyle {
  return v === "classic" || v === "glass";
}

/**
 * Catalogue generation backend — independent of the try-on provider.
 * Retailer picks Premium (gemini) or Economy (vertex); "auto" (category-
 * routed) was retired because it hid the provider's capability envelope
 * from the retailer (extras, casting, scene, quality). Any legacy "auto"
 * stored value coerces to "vertex" on load — see parseAiGenSettings.
 */
export type CatalogueProvider = "gemini" | "vertex";

export function isCatalogueProvider(v: unknown): v is CatalogueProvider {
  return v === "gemini" || v === "vertex";
}

export interface AiGenSettings {
  defaultModelType: ModelType;
  defaultObjective: GenerationObjective;
  /** Overlay the store logo (or name) on generated model images. */
  brandingEnabled: boolean;
  brandingPosition: BrandingPosition;
  /** Watermark look — classic text wordmark, or the frosted-glass chip. */
  brandingStyle: BrandingStyle;
  /** Backend for model-image generation (independent of try-on). Applies to
   *  both objectives — Quick Listing and Catalogue & Social. */
  catalogueProvider: CatalogueProvider;
  /**
   * Native Gemini output quality — retailer's remembered preference. Only
   * consumed on the Gemini path; Vertex ignores it (single output size).
   * Retailer picks it once and it sticks; each new product starts on the
   * remembered value unless they change it.
   */
  quality: GenerationQuality;
  /** Studio backdrop for generated images (Smart match, or a chosen preset). */
  backdrop: BackdropSelection;
  /**
   * Scenic scene/presence/detail choice. Persisted so it's remembered for
   * next time — but whether Scenic is even USED for a given generation is a
   * per-request choice (like generation quality), never a sticky default; see
   * `backdropSection` on GenerateModelImagesInput in engine.ts.
   */
  scenic: ScenicSelection;
}

export const DEFAULT_AI_GEN_SETTINGS: AiGenSettings = {
  defaultModelType: DEFAULT_MODEL_TYPE,
  defaultObjective: DEFAULT_OBJECTIVE,
  brandingEnabled: true,
  brandingPosition: "top-right",
  brandingStyle: "classic",
  // Economy is the safe default: cheaper, faster, no metadata surface to
  // mismanage. Retailers can opt in to Premium (Gemini) when they want
  // casting / scenes / quality / multi-image.
  catalogueProvider: "vertex",
  quality: DEFAULT_GENERATION_QUALITY,
  backdrop: { ...DEFAULT_BACKDROP_SELECTION },
  scenic: { ...DEFAULT_SCENIC_SELECTION },
};

/** Parse raw aiGenSettings JSON into a fully-populated, validated object. */
export function parseAiGenSettings(raw: string | null | undefined): AiGenSettings {
  if (!raw) return { ...DEFAULT_AI_GEN_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      defaultModelType: isModelType(parsed.defaultModelType)
        ? parsed.defaultModelType
        : DEFAULT_MODEL_TYPE,
      defaultObjective: isGenerationObjective(parsed.defaultObjective)
        ? parsed.defaultObjective
        : DEFAULT_OBJECTIVE,
      brandingEnabled:
        typeof parsed.brandingEnabled === "boolean"
          ? parsed.brandingEnabled
          : DEFAULT_AI_GEN_SETTINGS.brandingEnabled,
      brandingPosition: isBrandingPosition(parsed.brandingPosition)
        ? parsed.brandingPosition
        : DEFAULT_AI_GEN_SETTINGS.brandingPosition,
      brandingStyle: isBrandingStyle(parsed.brandingStyle)
        ? parsed.brandingStyle
        : DEFAULT_AI_GEN_SETTINGS.brandingStyle,
      // Legacy "auto" values (from the retired category-routed mode) coerce
      // to Vertex — the current safe default. Any other unknown value also
      // falls back to the default. New retailers get "vertex" from the
      // DEFAULT_AI_GEN_SETTINGS object above.
      catalogueProvider: isCatalogueProvider(parsed.catalogueProvider)
        ? parsed.catalogueProvider
        : DEFAULT_AI_GEN_SETTINGS.catalogueProvider,
      quality: isGenerationQuality(parsed.quality)
        ? parsed.quality
        : DEFAULT_AI_GEN_SETTINGS.quality,
      backdrop: parseBackdropSelection(parsed.backdrop),
      scenic: parseScenicSelection(parsed.scenic),
    };
  } catch {
    return { ...DEFAULT_AI_GEN_SETTINGS };
  }
}

export function serializeAiGenSettings(settings: AiGenSettings): string {
  return JSON.stringify(settings);
}

/** Load a retailer's AI-gen settings, falling back to defaults on any issue. */
export async function getAiGenSettings(userId: string): Promise<AiGenSettings> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { aiGenSettings: true },
    });
    return parseAiGenSettings(user?.aiGenSettings);
  } catch {
    return { ...DEFAULT_AI_GEN_SETTINGS };
  }
}
