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

// ─── Man model pool (automatic selection) ─────────────────────────────────────
//
// Unlike womenswear, men have no draped reference variants (a man never wears a
// saree). Instead the library carries several adult-male models, each styled at
// a different formality, and the system AUTO-SELECTS the closest one to the
// garment — no manual picker. Files live at
// public/reference-models/male-base-{n}.png.
//
// v1 selects on the signals that exist today: category, occasion and styleTags
// (a formality proxy). Color / pattern / design — the remaining signals the
// product owner wants to factor in — are NOT yet structured on Product; this is
// the single place to fold them in once those fields land (see the look-builder
// metadata work). The mapping below is data-shaped, like reference-selection.ts,
// so it can later be promoted to config or learned from the research log.

/** Curated adult-male models, ordered, each tagged with the look it is styled in. */
export const MAN_MODELS = [
  { file: "male-base-1", note: "white sweater + chinos — relaxed smart-casual" },
  { file: "male-base-2", note: "black shirt + tailored trousers — formal/business" },
  { file: "male-base-3", note: "navy tee + chinos — casual" },
  { file: "male-base-4", note: "beige polo + trousers + loafers — semi-formal/festive" },
  { file: "male-base-5", note: "grey polo + charcoal trousers — business-casual" },
] as const;

/** Neutral smart-casual default when the product gives no formality signal. */
export const DEFAULT_MAN_MODEL_FILE = "male-base-1";

/** Categories that are inherently formal menswear. */
const FORMAL_MAN_CATEGORIES = new Set<string>([
  "suit", "tie", "blazer", "tuxedo", "sherwani", "pocket_square", "cufflinks",
]);

/** Categories that read as explicitly casual. */
const CASUAL_MAN_CATEGORIES = new Set<string>([
  "t-shirt", "tshirt", "tee", "jeans", "shorts", "hoodie", "sweatshirt",
]);

/** Business-casual default categories (shirts/polos/trousers). */
const BUSINESS_CASUAL_CATEGORIES = new Set<string>([
  "shirt", "polo", "trouser", "trousers", "chinos",
]);

function includesAny(arr: string[], ...vals: string[]): boolean {
  return vals.some((v) => arr.includes(v));
}

/**
 * Pick the best adult-male reference model for a product by formality/occasion.
 * Pure and deterministic. Always returns one of MAN_MODELS' file basenames.
 */
export function selectManModelFile(p: {
  category?: string | null;
  occasion?: string[] | null;
  styleTags?: string[] | null;
}): string {
  const cat = p.category?.trim().toLowerCase() ?? "";
  const occ = (p.occasion ?? []).map((o) => o.toLowerCase());
  const styles = (p.styleTags ?? []).map((s) => s.toLowerCase());

  // Formal / business — sharp tailored look.
  if (
    FORMAL_MAN_CATEGORIES.has(cat) ||
    includesAny(occ, "formal", "office", "interview", "business")
  ) {
    return "male-base-2";
  }

  // Dressy occasions (wedding/party/festive) — semi-formal, warmer styling.
  if (
    includesAny(occ, "wedding", "party", "festive", "anniversary", "religious", "traditional") ||
    includesAny(styles, "royal", "festive", "traditional")
  ) {
    return "male-base-4";
  }

  // Explicitly casual.
  if (
    CASUAL_MAN_CATEGORIES.has(cat) ||
    includesAny(occ, "casual") ||
    includesAny(styles, "boho", "minimalist")
  ) {
    return "male-base-3";
  }

  // Business-casual default for shirts/polos/trousers.
  if (BUSINESS_CASUAL_CATEGORIES.has(cat)) {
    return "male-base-5";
  }

  // No formality signal — neutral smart-casual.
  return DEFAULT_MAN_MODEL_FILE;
}
