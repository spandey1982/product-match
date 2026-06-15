/**
 * AI Generation OBJECTIVES — the outcome a retailer chooses.
 *
 * A retailer picks an objective ("what do I want?"); the system resolves the
 * provider, reference assets, prompts and generation strategy internally.
 * Provider names (Gemini, Vertex) and model IDs are implementation details and
 * are never surfaced here. See docs/IMAGE_AI_ROADMAP.md.
 */

export type GenerationObjective = "quick_listing" | "catalogue";

/** Internal strategy a backend resolves to. Not shown to retailers. */
export type GenerationStrategy = "single" | "multi";

export interface ObjectiveDefinition {
  id: GenerationObjective;
  /** Retailer-facing label — outcome language, no provider names. */
  label: string;
  /** Retailer-facing description of the outcome. */
  description: string;
  /** Internal strategy: one image vs. a multi-view set. */
  strategy: GenerationStrategy;
}

export const OBJECTIVES: Record<GenerationObjective, ObjectiveDefinition> = {
  quick_listing: {
    id: "quick_listing",
    label: "Quick Listing",
    description:
      "One polished, ready-to-publish model photo. Fast and consistent — ideal for a single listing image.",
    strategy: "single",
  },
  catalogue: {
    id: "catalogue",
    label: "Catalogue & Social",
    description:
      "A set of catalogue-ready images from multiple angles, tailored to the product type. Best for full listings and social posts.",
    strategy: "multi",
  },
};

export const DEFAULT_OBJECTIVE: GenerationObjective = "catalogue";

export function isGenerationObjective(v: unknown): v is GenerationObjective {
  return v === "quick_listing" || v === "catalogue";
}

export function listObjectives(): ObjectiveDefinition[] {
  return Object.values(OBJECTIVES);
}
