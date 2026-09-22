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

/** V1's two content modes — meaningful within "styled-promo" and
 * "promo-benefits"; "hero-editorial" ignores this and is always
 * aspirational (price structurally absent). See research Part 7. */
export type ContentMode = "aspirational" | "price-led";

/**
 * The three V1.2 template families (see the plan's Context section for the
 * research behind this split): "promo-benefits" is the primary/default —
 * dense, feature-row + price-banner + trust-badge, matching the retailer's
 * reference image and the "Product Benefits" creative pattern documented in
 * research/catalogue-to-campaign.html. "hero-editorial" and "styled-promo"
 * are V1's original full-bleed renderer, kept as clearly-labeled secondary
 * options for premium/luxury-tier or designer-collaboration retailers.
 */
export type TemplateFamily = "promo-benefits" | "hero-editorial" | "styled-promo";

/** Which layout geometry a template family uses — drives how the renderer
 * builds its Satori tree and how the hero photo gets composited. All three
 * families are full-bleed as of the V1.3 revision (see renderer.tsx's
 * header) — kept as a union rather than inlining "full-bleed" everywhere so
 * a genuinely different geometry (e.g. a video/reel layout) has somewhere
 * to slot in later. */
export type TemplateLayout = "full-bleed";

/**
 * Closed set of icon keys a feature row or trust badge can reference —
 * mapped to actual lucide-react components inside renderer.tsx (kept out
 * of this framework-independent file). Small and fixed for V1.2; see the
 * plan's "what stays generic" note.
 */
export type IconKey = "sparkles" | "feather" | "check-circle" | "award" | "wind" | "droplet" | "arrow-right";

export interface FeatureRow {
  icon: IconKey;
  label: string;
  description: string;
}

export interface TrustBadge {
  icon: IconKey;
  label: string;
}

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
  /** Formatted current price (e.g. "Rs. 2,499"), or null when priceVisibility is "suppressed". */
  priceText: string | null;
  /** e.g. "35% OFF" — present only when contentMode is "price-led" and a real discount exists. */
  discountBadge: string | null;
  ctaText: string;
  /** promo-benefits only — a short generic tagline. Null for the other two families. */
  kicker: string | null;
  /** promo-benefits only — 3 generic feature rows, material-aware. Empty for the other two families. */
  features: FeatureRow[];
  /** promo-benefits only — 4 generic trust badges. Empty for the other two families. */
  trustBadges: TrustBadge[];
}

export interface RenderedOutput {
  aspectRatio: CanvasKey;
  url: string;
  width: number;
  height: number;
}
