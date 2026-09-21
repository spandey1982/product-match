/**
 * Marketing Creative Generation System — V1 shared types.
 *
 * Framework-independent: no Next.js/Prisma imports here, mirroring
 * lib/catalogue-motion/types.ts's own discipline — this is the contract
 * between the template registry, the hero-source resolver, the renderer,
 * and the orchestrator/worker layer above it.
 *
 * See research/catalogue-to-campaign.html for the taxonomy/architecture
 * this implements (creative families, template grammar, Brand Creative
 * Profile) and reports/Marketing creative generation system.md Part 5-7.
 */

/** How the hero region's image was/should be sourced. Always concrete —
 * "auto" (the retailer's request) resolves to one of these three before
 * anything renders; see hero-source.ts. */
export type HeroSourceMode = "reuse-catalogue" | "generate-new" | "product-only";

/** What the retailer can actually ask for — "auto" defers the decision to
 * hero-source.ts's rules. */
export type RequestedHeroSourceMode = "auto" | HeroSourceMode;

/** V1's two content modes within the shared hero-promo template family —
 * see research Part 7 (V1 scope). */
export type ContentMode = "aspirational" | "price-led";

/** V1's retail objective set (report Part 2.1, narrowed to what the
 * hero-promo family actually serves). */
export type CreativeObjective = "discovery" | "price_promotion" | "seasonal_occasion";

/** Optional platform hint — informs canvas defaults and the hero-source
 * decision table, never required (report Part 4.5). */
export type PlatformHint = "instagram-feed" | "instagram-story" | "website-banner" | "pinterest";

export type CanvasKey = "square" | "vertical" | "pinterest";

export interface Canvas {
  key: CanvasKey;
  label: string;
  width: number;
  height: number;
}

/** A fractional region within the canvas — same {x,y,w,h} shape as
 * lib/model-gen/crop-templates.ts's CropRegion, for the same reason: cheap
 * to reason about, resolution-independent. */
export interface FractionalRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DeterministicCopy {
  title: string;
  /** Formatted current price (e.g. "₹2,499"), or null when priceVisibility is "suppressed". */
  priceText: string | null;
  /** e.g. "35% OFF" — present only when contentMode is "price-led" and a real discount exists. */
  discountBadge: string | null;
  ctaText: string;
}

export interface RenderedOutput {
  aspectRatio: CanvasKey;
  url: string;
  width: number;
  height: number;
}
