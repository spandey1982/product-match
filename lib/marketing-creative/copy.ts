/**
 * Deterministic copy generation — V1/V1.2 has NO LLM call anywhere in this
 * file. Every string is pure formatting of fields already on the Product
 * record, per research/catalogue-to-campaign.html Part 6.3's hard rule:
 * copy must never assert a claim the structured data doesn't support.
 *
 * The feature-row/trust-badge library added for "promo-benefits" (V1.2)
 * follows the same discipline as formatDiscountBadge below: a small, fixed
 * set of generic, category-safe marketing phrases (never a specific
 * unverified claim), with exactly one data-aware substitution — the fabric
 * row surfaces Product.material's real value when set, and falls back to
 * generic phrasing when it's null. Nothing here invents a fabric, craft
 * technique, or certification not already on the record.
 */
import type { ContentMode, CreativeObjective, DeterministicCopy, FeatureRow, TemplateFamily, TrustBadge } from "./types";
import type { PriceVisibilityKey } from "@/lib/branding/creative-tier";
import type { GarmentIntelligence, SurfaceTechnique } from "@/lib/garment-intelligence/types";

export interface CopyProductInput {
  title: string;
  price: number;
  mrpPrice: number | null;
  discountPercent: number | null;
  material?: string | null;
  category?: string | null;
}

/** en-IN grouping (lakhs/crores), no decimals. Prefixed with the literal
 * "Rs. " rather than the ₹ glyph deliberately — live-tested (2026-09-21) and
 * confirmed the ₹ (U+20B9) glyph is missing from every Inter subset
 * @fontsource ships (latin and latin-ext both render it as a "no glyph"
 * tofu box via Satori/resvg), and this is a deterministic, always-rendered
 * price region — it must never show a missing-glyph box to a retailer.
 * "Rs." is plain ASCII, guaranteed to render in any Latin font. */
const NUMBER_FORMATTER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatPrice(price: number): string {
  return `Rs. ${NUMBER_FORMATTER.format(price)}`;
}

/** Null when there's no real discount to show — never invents one. */
export function formatDiscountBadge(discountPercent: number | null): string | null {
  if (!discountPercent || discountPercent <= 0) return null;
  return `${Math.round(discountPercent)}% OFF`;
}

// Small, fixed objective→CTA map. Not exhaustive of report Part 2.1's full
// objective set — scoped to the objectives V1's families actually serve.
const CTA_BY_OBJECTIVE: Record<CreativeObjective, string> = {
  discovery: "Shop Now",
  price_promotion: "Shop the Sale",
  seasonal_occasion: "Shop the Collection",
};

export function resolveCtaText(objective: CreativeObjective): string {
  return CTA_BY_OBJECTIVE[objective] ?? "Shop Now";
}

// Generic, non-factual taglines — same safety class as the CTA map above.
const KICKER_BY_OBJECTIVE: Record<CreativeObjective, string> = {
  discovery: "Comfort Meets Style",
  price_promotion: "Limited Time Offer",
  seasonal_occasion: "Shop the Season",
};

export function resolveKicker(objective: CreativeObjective): string {
  return KICKER_BY_OBJECTIVE[objective] ?? "Comfort Meets Style";
}

/**
 * The three "promo-benefits" feature rows. Fabric row is the one
 * data-aware slot — real Product.material when set, generic fallback
 * otherwise. Style and fit rows are deliberately generic across every
 * category for V1.2 (see the plan's "what stays generic" note);
 * category-specific variants are a V1.3+ item, not invented here.
 */
export function buildFeatureRows(material?: string | null): FeatureRow[] {
  return [
    { icon: "sparkles", label: "Trendy Design", description: "Stylish look for every occasion" },
    {
      icon: "feather",
      label: "Premium Fabric",
      description: material ? `${material} — soft, breathable & skin-friendly` : "Soft, breathable & skin-friendly",
    },
    { icon: "check-circle", label: "Perfect Fit", description: "Comfortable all-day wear" },
  ];
}

// Fixed set of 4 — generic marketing boilerplate, not per-product claims.
export function buildTrustBadges(): TrustBadge[] {
  return [
    { icon: "award", label: "Premium Quality" },
    { icon: "wind", label: "Soft & Breathable" },
    { icon: "feather", label: "Lightweight Fabric" },
    { icon: "droplet", label: "Easy Care" },
  ];
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

// GI's texture/construction fields are typed as loose strings — the vision
// pass sometimes returns a short phrase ("soft, fluid") and sometimes a
// full sentence ("skirt has a structured, full drape; dupatta appears soft
// and flowing" — live-tested 2026-09-24 on a real lehenga's GI record).
// Labels/badges have real, limited rendering width; a sentence there
// overflows rather than wrapping gracefully. Reject anything sentence-
// shaped (a semicolon, terminal punctuation, or just too long) instead of
// truncating mid-word — the generic fallback is always better than a cut-
// off run-on.
const MAX_SHORT_PHRASE_LENGTH = 32;
function shortPhrase(s: string | null | undefined): string | null {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_SHORT_PHRASE_LENGTH) return null;
  if (/[;.!?]$/.test(trimmed) || trimmed.includes(";")) return null;
  return trimmed;
}

/** Title-cases a GI-extracted label phrase (the vision pass returns lower-
 * case noun phrases like "intricate mirror work") — every OTHER label in
 * this file (generic + GI-derived) reads as a heading, so GI's shouldn't
 * be the one exception. */
function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

/** e.g. "Dense mirror work — all over blouse, vertical panels and border on
 * skirt" — the closest thing GI has to a ready-made feature description:
 * real density + technique name + real placement, never invented.
 * Sentence-case (only the first letter), matching every other description
 * in this file ("Stylish look for every occasion") — title-casing is for
 * LABELS only (see titleCase), not the smaller description line below it. */
function techniqueDescription(t: SurfaceTechnique): string {
  const bits: string[] = [];
  if (t.density) bits.push(t.density);
  bits.push(t.type);
  const line = capitalize(bits.join(" "));
  return t.placement ? `${line} — ${t.placement}` : line;
}

/**
 * Garment Intelligence → feature rows (V1.6). `craftsmanship.highlights`
 * ("the 2-4 things a buyer would notice first" per garment-intelligence/
 * types.ts) become up to 3 feature labels, in place of the fixed "Trendy
 * Design / Premium Fabric / Perfect Fit" — this is the actual fix for two
 * different products rendering near-identical copy. Falls back to
 * buildFeatureRows() row-by-row wherever GI doesn't have a corresponding
 * highlight, never leaving a row blank. GI fields are themselves vision-
 * extracted structured facts, not invented at copy time — same discipline
 * the existing `material` substitution already established.
 */
function buildIntelligentFeatureRows(intelligence: GarmentIntelligence | null | undefined, material?: string | null): FeatureRow[] {
  const generic = buildFeatureRows(material);
  if (!intelligence) return generic;

  const highlights = intelligence.craftsmanship.highlights.filter((h) => h && h.trim().length > 0);
  const rows: FeatureRow[] = [...generic];

  if (highlights[0]) {
    rows[0] = {
      icon: "sparkles",
      label: titleCase(highlights[0]),
      description: intelligence.surfaceTechniques[0] ? techniqueDescription(intelligence.surfaceTechniques[0]) : generic[0].description,
    };
  }

  // Fabric row keeps the existing material substitution as its base — only
  // enriches it with texture.finish/drape when GI has that AND it's short-
  // phrase shaped (see shortPhrase's header), and only swaps the LABEL when
  // a second highlight exists, never inventing a fabric.
  const textureBits = [shortPhrase(intelligence.texture.finish), shortPhrase(intelligence.texture.drape)].filter(
    (v): v is string => v !== null
  );
  if (textureBits.length > 0 || highlights[1]) {
    rows[1] = {
      icon: "feather",
      label: highlights[1] ? titleCase(highlights[1]) : "Premium Fabric",
      description:
        textureBits.length > 0
          ? material
            ? `${material} — ${textureBits.join(", ")}`
            : `${capitalize(textureBits.join(", "))} finish`
          : generic[1].description,
    };
  }

  if (highlights[2]) {
    const fit = [intelligence.construction.length, intelligence.construction.sleeves]
      .filter((v) => v && v.trim().length > 0)
      .map((v) => shortPhrase(v))
      .filter((v): v is string => v !== null);
    rows[2] = {
      icon: "check-circle",
      label: titleCase(highlights[2]),
      description: fit.length > 0 ? capitalize(fit.join(", ")) : generic[2].description,
    };
  }

  return rows;
}

/**
 * Garment Intelligence → trust badges (V1.6). Swaps up to 2 of the 4 fixed
 * badges for GI-derived ones when the underlying field is present; keeps
 * the rest of the generic set as-is (GI doesn't speak to care instructions
 * like "Easy Care", so that one never changes).
 */
function buildIntelligentTrustBadges(intelligence: GarmentIntelligence | null | undefined, category?: string | null): TrustBadge[] {
  const generic = buildTrustBadges();
  if (!intelligence) return generic;
  const badges: TrustBadge[] = [...generic];

  if (intelligence.craftsmanship.handcrafted) {
    badges[0] = { icon: "award", label: "Handcrafted Detail" };
  }
  const shortDrape = shortPhrase(intelligence.texture.drape);
  const shortFinish = shortPhrase(intelligence.texture.finish);
  const textureLabel = shortDrape ? `${capitalize(shortDrape)} Drape` : shortFinish ? `${capitalize(shortFinish)} Finish` : null;
  if (textureLabel) {
    badges[1] = { icon: "wind", label: textureLabel };
  }

  // Live-tested (2026-09-24): a genuine 5th ADDITIVE badge (pushed onto the
  // array rather than replacing a slot) overflowed the vertical canvas —
  // 3 multi-line feature rows plus 5 wrapped badges is taller than 1350px,
  // and Satori clips whatever doesn't fit rather than shrinking it. This is
  // exactly the failure class V1.5's masthead removal undid (guessing that
  // space is available without measuring it). Fixed by REPLACING a slot
  // instead of adding one — same 4-item footprint as the generic set,
  // always, so this can never be the thing that pushes a render over its
  // own canvas. "Lightweight Fabric" is the slot swapped (the closest thing
  // to a duplicate of the texture badge above it when both are present).
  const motif = shortPhrase(intelligence.pattern.motifs[0]);
  const bonusLabel = motif ? titleCase(motif) : category && category.trim() ? category.trim() : null;
  if (bonusLabel) {
    badges[2] = { icon: "sparkles", label: bonusLabel };
  }

  return badges;
}

/**
 * Objective stays the PRIMARY signal — a sale campaign should still say
 * "Limited Time Offer", not a craftsmanship tone. Only the "discovery"
 * objective's neutral default gets a craftsmanship-aware swap, and only
 * for genuinely heavy, handcrafted pieces (never invents a tier GI didn't
 * report).
 */
function resolveIntelligentKicker(objective: CreativeObjective, intelligence: GarmentIntelligence | null | undefined): string {
  if (objective !== "discovery" || !intelligence) return resolveKicker(objective);
  if (intelligence.craftsmanship.handcrafted && intelligence.craftsmanship.overallDensity?.toLowerCase() === "heavy") {
    return "Artisan Crafted";
  }
  return resolveKicker(objective);
}

/**
 * Builds the full deterministic copy set for one render. Price/discount are
 * suppressed entirely when priceVisibility is "suppressed", or when the
 * family is "hero-editorial" (structurally price-less — see templates.ts),
 * regardless of contentMode — the Brand Creative Profile's policy and the
 * family's own structure always win over what a single request asks for.
 */
export function buildDeterministicCopy(
  product: CopyProductInput,
  priceVisibility: PriceVisibilityKey,
  contentMode: ContentMode,
  objective: CreativeObjective,
  templateFamily: TemplateFamily,
  // V1.6, optional and additive: every existing caller that doesn't pass
  // this gets exactly today's generic-library output — see
  // buildIntelligentFeatureRows/Badges/Kicker's own fallback behavior.
  intelligence?: GarmentIntelligence | null
): DeterministicCopy {
  const isPromoBenefits = templateFamily === "promo-benefits";

  // hero-editorial: never (structurally price-less). promo-benefits: shows
  // the price banner whenever the Brand Creative Profile allows it — it's
  // a standing region there, not tied to aspirational/price-led the way
  // styled-promo's inline price is. styled-promo: V1's original
  // price-led-only gating, unchanged.
  const showPrice =
    priceVisibility !== "suppressed" &&
    (isPromoBenefits || (templateFamily === "styled-promo" && contentMode === "price-led"));

  return {
    title: product.title,
    priceText: showPrice ? formatPrice(product.price) : null,
    discountBadge: showPrice ? formatDiscountBadge(product.discountPercent) : null,
    ctaText: resolveCtaText(objective),
    kicker: isPromoBenefits ? resolveIntelligentKicker(objective, intelligence) : null,
    features: isPromoBenefits ? buildIntelligentFeatureRows(intelligence, product.material) : [],
    trustBadges: isPromoBenefits ? buildIntelligentTrustBadges(intelligence, product.category) : [],
  };
}
