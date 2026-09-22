/**
 * The V1.2 template grammar — a small, data-driven region registry across
 * the three template families (research/catalogue-to-campaign.html Part
 * 5.3/7 + the plan's V1.2 revision), mirroring
 * lib/catalogue-motion/storyboards.ts's data-not-hardcoded pattern: which
 * named regions a given render actually needs, resolved once per request
 * rather than branching scattered through the renderer.
 *
 * "promo-benefits" is the primary/default family (dense, feature-row +
 * price + trust-badge content, full-bleed with a left-to-right gradient —
 * V1.3 revision, see renderer.tsx's header for why it moved off the
 * original split-panel geometry). "hero-editorial" and "styled-promo" are
 * V1's original full-bleed renderer, kept as clearly-labeled secondary
 * options — see the plan's Context section for why.
 */
import type { ContentMode, TemplateFamily, TemplateLayout } from "./types";
import type { BrandTierKey } from "@/lib/branding/creative-tier";

/**
 * The default family when a retailer leaves it on "auto" — dense/detailed
 * ("promo-benefits") is the default for the platform's actual retailer
 * base (small-to-mid D2C sellers who win on communicated detail, not brand
 * recognition — see the plan's Context section), except for the luxury/
 * boutique-tier minority, who default to the minimal "hero-editorial"
 * register instead. An explicit request always overrides this.
 */
export function resolveDefaultTemplateFamily(brandTier: BrandTierKey): TemplateFamily {
  return brandTier === "luxury" || brandTier === "boutique" ? "hero-editorial" : "promo-benefits";
}

export type RegionId =
  | "scrim"
  | "logo"
  | "title"
  | "price"
  | "cta"
  | "kicker"
  | "features"
  | "trustBadges";

export interface TemplateRegion {
  id: RegionId;
  present: boolean;
}

export interface CreativeTemplate {
  templateFamily: TemplateFamily;
  layout: TemplateLayout;
  contentMode: ContentMode;
  regions: TemplateRegion[];
}

/**
 * Resolves the region set + layout for one render. `hasPriceText` reflects
 * the Brand Creative Profile's price-visibility policy already applied in
 * copy.ts's buildDeterministicCopy() — a price-bearing region is never
 * present when there's no priceText to show, regardless of contentMode.
 */
export function resolveTemplate(
  templateFamily: TemplateFamily,
  contentMode: ContentMode,
  hasPriceText: boolean,
  hasLogo: boolean
): CreativeTemplate {
  if (templateFamily === "promo-benefits") {
    return {
      templateFamily,
      layout: "full-bleed",
      contentMode,
      regions: [
        { id: "scrim", present: true },
        { id: "kicker", present: true },
        { id: "title", present: true },
        { id: "features", present: true },
        { id: "price", present: hasPriceText },
        { id: "trustBadges", present: true },
        { id: "logo", present: hasLogo },
        { id: "cta", present: true },
      ],
    };
  }

  if (templateFamily === "hero-editorial") {
    // Structurally price-less — luxury/premium positioning never shows
    // price in the creative itself (report Part 3.1), independent of
    // priceVisibility policy or a caller-requested contentMode.
    return {
      templateFamily,
      layout: "full-bleed",
      contentMode: "aspirational",
      regions: [
        { id: "scrim", present: true },
        { id: "logo", present: hasLogo },
        { id: "title", present: true },
        { id: "cta", present: true },
      ],
    };
  }

  // "styled-promo" — V1's original region set, unchanged.
  return {
    templateFamily,
    layout: "full-bleed",
    contentMode,
    regions: [
      { id: "scrim", present: true },
      { id: "logo", present: hasLogo },
      { id: "title", present: true },
      { id: "price", present: contentMode === "price-led" && hasPriceText },
      { id: "cta", present: true },
    ],
  };
}

export function isRegionPresent(template: CreativeTemplate, id: RegionId): boolean {
  return template.regions.some((r) => r.id === id && r.present);
}
