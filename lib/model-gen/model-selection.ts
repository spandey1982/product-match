/**
 * Automatic reference-model TYPE selection (woman / man / girl / boy).
 *
 * The retailer doesn't pick a model per product — the system chooses it from
 * the product itself, along two axes:
 *   • sex   — some categories are inherently female (a saree is never on a man);
 *             otherwise it comes from the product's gender.
 *   • age   — kid (girl/boy) vs adult (woman/man), from the product's gender.
 *
 * The VARIANT (saree/lehenga/…) is chosen separately by category in
 * reference-selection.ts. Together they resolve to a file like `woman-saree`.
 *
 * Future (see docs/IMAGE_AI_ROADMAP.md): each type may offer several models with
 * a per-type default, and the age axis may be inferred from category too (e.g.
 * "kids lehenga"). This resolver is the single place that grows for both.
 */
import type { ModelType } from "./reference-models";

/**
 * Categories that are inherently womenswear/girlswear — never a man or boy.
 * For these the sex is forced female regardless of a (possibly mis-tagged)
 * gender field; the age axis still comes from gender.
 */
const FEMALE_ONLY_CATEGORIES = new Set<string>([
  "saree", "lehenga", "sharara", "anarkali", "blouse", "dupatta",
  "salwar", "gown", "kurti", "skirt", "legging", "leggings",
]);

/** Normalized product gender values (from Product.gender). */
function isKidGender(g: string): boolean {
  return g === "GIRLS" || g === "BOYS";
}

/**
 * Resolve the reference-model type for a product.
 *
 * @param category  product category (drives the female-only override)
 * @param gender    product gender (WOMEN | MEN | GIRLS | BOYS | UNISEX | …)
 * @param fallback  store default, used only when the product gives no sex signal
 *                  (e.g. a UNISEX accessory with a non-gendered category)
 */
export function resolveModelType(
  category: string | null | undefined,
  gender: string | null | undefined,
  fallback: ModelType
): ModelType {
  const cat = category?.trim().toLowerCase() ?? "";
  const g = (gender ?? "").trim().toUpperCase();
  const kid = isKidGender(g);

  // ── Sex axis ──────────────────────────────────────────────────────────────
  let female: boolean | null = null;
  if (FEMALE_ONLY_CATEGORIES.has(cat)) {
    female = true;
  } else if (g === "WOMEN" || g === "GIRLS") {
    female = true;
  } else if (g === "MEN" || g === "BOYS") {
    female = false;
  }
  // UNISEX / unknown + non-gendered category → no signal.

  if (female === null) return fallback;

  // ── Age axis ────────────────────────────────────────────────────────────
  if (female) return kid ? "girl" : "woman";
  return kid ? "boy" : "man";
}
