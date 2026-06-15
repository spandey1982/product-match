/**
 * Category-aware reference-variant selection.
 *
 * Given a product category, pick the model variant whose pose/drape yields the
 * most consistent result (e.g. saree → a saree-draped model). Pure and
 * data-shaped (a plain map), mirroring lib/providers/auto-routing.ts, so it can
 * later be promoted to per-retailer config or learned from the research log
 * without changing callers. See docs/IMAGE_AI_ROADMAP.md §8.
 *
 * Examples (from the spec):
 *   saree   → {model}-saree
 *   lehenga → {model}-lehenga
 *   shirt   → {model}-basic
 */
import type { ModelVariant } from "./reference-models";

/** Category (lowercased) → variant. Unlisted categories use the fallback. */
const CATEGORY_VARIANT: Record<string, ModelVariant> = {
  // Saree-like drapes
  saree: "saree",
  dupatta: "saree", // a dupatta drapes like a saree pallu
  // Lehenga-like flared sets
  lehenga: "lehenga",
  sharara: "lehenga",
  // Stitched ethnic suits / tunics
  kurta: "kurti",
  kurti: "kurti",
  salwar: "kurti",
  anarkali: "kurti",
  suit: "kurti",
  // Western / structured (future-facing categories)
  dress: "western",
  gown: "western",
  jumpsuit: "western",
  "co-ord": "western",
  western: "western",
  // Everything else (blouse, palazzo, jewellery, footwear, clutch, handbag,
  // tie, other, ...) → basic
};

/** Fallback when a category is unmapped — the neutral "basic" model. */
export const DEFAULT_VARIANT: ModelVariant = "basic";

export function resolveReferenceVariant(
  category: string | null | undefined
): ModelVariant {
  const key = category?.trim().toLowerCase() ?? "";
  return CATEGORY_VARIANT[key] ?? DEFAULT_VARIANT;
}
