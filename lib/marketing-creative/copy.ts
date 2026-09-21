/**
 * Deterministic copy generation — V1 has NO LLM call anywhere in this file.
 * Every string is pure formatting of fields already on the Product record,
 * per research/catalogue-to-campaign.html Part 6.3's hard rule: copy must
 * never assert a claim the structured data doesn't support. LLM-assisted
 * copy variation (still constrained the same way) is an explicit V1.5+
 * item, not V1 — see the plan's Part 7 phasing.
 */
import type { ContentMode, CreativeObjective, DeterministicCopy } from "./types";
import type { PriceVisibilityKey } from "@/lib/branding/creative-tier";

export interface CopyProductInput {
  title: string;
  price: number;
  mrpPrice: number | null;
  discountPercent: number | null;
}

/** en-IN grouping (lakhs/crores), no decimals. Prefixed with the literal
 * "Rs." rather than the ₹ glyph deliberately — live-tested (2026-09-21) and
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
// objective set — scoped to the objectives V1's hero-promo family actually
// serves (report Part 7).
const CTA_BY_OBJECTIVE: Record<CreativeObjective, string> = {
  discovery: "Shop Now",
  price_promotion: "Shop the Sale",
  seasonal_occasion: "Shop the Collection",
};

export function resolveCtaText(objective: CreativeObjective): string {
  return CTA_BY_OBJECTIVE[objective] ?? "Shop Now";
}

/**
 * Builds the full deterministic copy set for one render. Price/discount are
 * suppressed entirely when priceVisibility is "suppressed", regardless of
 * contentMode — the Brand Creative Profile's price-visibility policy always
 * wins over what a single generation request asks for (report Part 5.2).
 */
export function buildDeterministicCopy(
  product: CopyProductInput,
  priceVisibility: PriceVisibilityKey,
  contentMode: ContentMode,
  objective: CreativeObjective
): DeterministicCopy {
  const showPrice = priceVisibility !== "suppressed" && contentMode === "price-led";
  return {
    title: product.title,
    priceText: showPrice ? formatPrice(product.price) : null,
    discountBadge: showPrice ? formatDiscountBadge(product.discountPercent) : null,
    ctaText: resolveCtaText(objective),
  };
}
