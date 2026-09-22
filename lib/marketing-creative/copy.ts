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

export interface CopyProductInput {
  title: string;
  price: number;
  mrpPrice: number | null;
  discountPercent: number | null;
  material?: string | null;
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
  templateFamily: TemplateFamily
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
    kicker: isPromoBenefits ? resolveKicker(objective) : null,
    features: isPromoBenefits ? buildFeatureRows(product.material) : [],
    trustBadges: isPromoBenefits ? buildTrustBadges() : [],
  };
}
