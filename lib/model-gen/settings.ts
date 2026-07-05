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
  isBackdropSection,
  parseScenicSelection,
  type BackdropSection,
  type ScenicSelection,
} from "./scenes/selection";

/** Where the brand watermark sits on generated model images. */
export type BrandingPosition = "top-left" | "top-right";

export function isBrandingPosition(v: unknown): v is BrandingPosition {
  return v === "top-left" || v === "top-right";
}

/**
 * Catalogue generation backend — independent of the try-on provider.
 * "auto" routes by category (drape→Natural Drape, structured→Sharp Fit).
 */
export type CatalogueProvider = "auto" | "gemini" | "vertex";

export function isCatalogueProvider(v: unknown): v is CatalogueProvider {
  return v === "auto" || v === "gemini" || v === "vertex";
}

export interface AiGenSettings {
  defaultModelType: ModelType;
  defaultObjective: GenerationObjective;
  /** Overlay the store logo (or name) on generated model images. */
  brandingEnabled: boolean;
  brandingPosition: BrandingPosition;
  /** Backend for the Catalogue & Social objective (independent of try-on). */
  catalogueProvider: CatalogueProvider;
  /** Studio backdrop for generated images (Smart match, or a chosen preset). */
  backdrop: BackdropSelection;
  /** Top-level chooser: the plain Studio backdrop, or a Scenic Collection environment. */
  backdropSection: BackdropSection;
  /** Scenic Collection choice — read only when backdropSection === "scenic". */
  scenic: ScenicSelection;
}

export const DEFAULT_AI_GEN_SETTINGS: AiGenSettings = {
  defaultModelType: DEFAULT_MODEL_TYPE,
  defaultObjective: DEFAULT_OBJECTIVE,
  brandingEnabled: true,
  brandingPosition: "top-right",
  catalogueProvider: "auto",
  backdrop: { ...DEFAULT_BACKDROP_SELECTION },
  backdropSection: "studio",
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
      catalogueProvider: isCatalogueProvider(parsed.catalogueProvider)
        ? parsed.catalogueProvider
        : DEFAULT_AI_GEN_SETTINGS.catalogueProvider,
      backdrop: parseBackdropSelection(parsed.backdrop),
      backdropSection: isBackdropSection(parsed.backdropSection)
        ? parsed.backdropSection
        : DEFAULT_AI_GEN_SETTINGS.backdropSection,
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
