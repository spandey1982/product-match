import type { TryOnProviderId } from "./types";

/**
 * Deterministic category → try-on provider routing (Task 4, "Auto" mode).
 *
 * Rationale: Vertex VTO is strong on structured/western apparel and shoes but
 * mis-drapes complex Indian garments (folded saree/lehenga/dupatta); Gemini's
 * prompt-based try-on handles those better. So drape-heavy categories and
 * accessories route to Gemini; structured apparel and footwear route to Vertex.
 *
 * Kept intentionally simple and data-shaped (a plain map + small context) so it
 * can later be (a) overridden per-retailer from settings, (b) extended with more
 * signals (gender, material, drape attributes), or (c) replaced by data-driven
 * routing learned from the generation_records (quality) and ai_usage_events
 * (cost) tables — without changing callers. See docs/IMAGE_AI_ROADMAP.md §7–8.
 */

/** Context available to the router. Optional fields keep future signals additive. */
export interface RoutingContext {
  category?: string;
  // Future signals (not used yet): gender?, material?, drapeComplexity?, ...
}

/** Fallback when a category is unmapped — the safe system default. */
export const AUTO_FALLBACK_PROVIDER: TryOnProviderId = "gemini";

/** Category (lowercased) → provider. Unlisted categories use the fallback. */
const CATEGORY_PROVIDER: Record<string, TryOnProviderId> = {
  // Complex drape — Gemini
  saree: "gemini",
  lehenga: "gemini",
  dupatta: "gemini",
  anarkali: "gemini",
  gown: "gemini",
  // Structured apparel — Vertex
  kurti: "vertex",
  kurta: "vertex",
  shirt: "vertex",
  top: "vertex",
  blouse: "vertex",
  palazzo: "vertex",
  trousers: "vertex",
  pants: "vertex",
  skirt: "vertex",
  dress: "vertex",
  "co-ord": "vertex",
  // Footwear — Vertex (GA model improved shoes)
  footwear: "vertex",
  // Accessories — Gemini (VTO is garment/shoe-focused)
  jewellery: "gemini",
  handbag: "gemini",
  clutch: "gemini",
};

/**
 * Resolve the preferred provider for a product via category rules.
 * Pure and synchronous — capability/availability fallback is applied by the
 * caller (getActiveTryOnProvider), which downgrades to Gemini if the chosen
 * provider isn't enabled in this environment.
 */
export function resolveAutoProvider(context: RoutingContext): TryOnProviderId {
  const key = context.category?.trim().toLowerCase() ?? "";
  return CATEGORY_PROVIDER[key] ?? AUTO_FALLBACK_PROVIDER;
}
