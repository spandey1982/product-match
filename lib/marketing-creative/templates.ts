/**
 * The V1 template grammar — a small, data-driven region registry for the
 * shared "hero-promo" template family (research/catalogue-to-campaign.html
 * Part 5.3/7), mirroring lib/catalogue-motion/storyboards.ts's
 * data-not-hardcoded pattern: which named regions a given render actually
 * needs, resolved once per request rather than branching scattered through
 * the renderer.
 *
 * V1 deliberately has ONE template family with two content modes rather
 * than per-brand-tier layouts — brand differentiation for V1 comes from the
 * Brand Creative Profile (logo presence, price-visibility) driving which
 * regions are PRESENT, not from swapping layouts (report Part 7: minimum
 * complexity, not minimum coverage).
 */
import type { ContentMode } from "./types";

export type RegionId = "scrim" | "logo" | "title" | "price" | "cta";

export interface TemplateRegion {
  id: RegionId;
  present: boolean;
}

export interface CreativeTemplate {
  templateFamily: "hero-promo";
  contentMode: ContentMode;
  regions: TemplateRegion[];
}

/**
 * Resolves the region set for one render. `hasPriceText` reflects the
 * Brand Creative Profile's price-visibility policy already applied in
 * copy.ts's buildDeterministicCopy() — the price region is never present
 * when there's no priceText to show, regardless of contentMode.
 */
export function resolveTemplate(contentMode: ContentMode, hasPriceText: boolean, hasLogo: boolean): CreativeTemplate {
  return {
    templateFamily: "hero-promo",
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
