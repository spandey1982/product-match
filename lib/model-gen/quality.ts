/**
 * Generation QUALITY — native Gemini output resolution, chosen per generation.
 *
 * Confirmed by local R&D benchmarking (see PROJECT_KNOWLEDGE.md, "Resolution
 * and hallucination risk"): native 2K reproduces fine fabric/embroidery detail
 * more faithfully than the previous implicit default, at a modest token-cost
 * increase — but going ABOVE 2K to native 4K has been observed to fabricate
 * detail that isn't on the real product, so never raise this default past
 * what's already here without re-reading that section first. Not yet a
 * durable "quality tier" system — no entitlements,
 * persistence or subscription logic. A retailer picks Enhanced per
 * generation; it never carries over to the next one.
 */

export type GenerationQuality = "standard" | "enhanced";

export interface QualityProfile {
  id: GenerationQuality;
  /** Retailer-facing label. */
  label: string;
  /** Retailer-facing one-line description. */
  description: string;
  /** Gemini generationConfig.imageConfig.imageSize. */
  imageSize: "1K" | "2K";
  /** Gemini generationConfig.imageConfig.aspectRatio — always explicit, never the provider default. */
  aspectRatio: string;
}

const QUALITY_PROFILES: Record<GenerationQuality, QualityProfile> = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "Native 1K generation. Fast, and the default for every new generation.",
    imageSize: "1K",
    aspectRatio: "3:4",
  },
  enhanced: {
    id: "enhanced",
    label: "Enhanced",
    description: "Native 2K generation — richer fabric and embroidery detail. Slower and higher cost per image.",
    imageSize: "2K",
    aspectRatio: "3:4",
  },
};

export const DEFAULT_GENERATION_QUALITY: GenerationQuality = "standard";

export function isGenerationQuality(v: unknown): v is GenerationQuality {
  return v === "standard" || v === "enhanced";
}

export function getQualityProfile(quality?: GenerationQuality): QualityProfile {
  return QUALITY_PROFILES[quality ?? DEFAULT_GENERATION_QUALITY];
}

export function listQualityProfiles(): QualityProfile[] {
  return Object.values(QUALITY_PROFILES);
}
