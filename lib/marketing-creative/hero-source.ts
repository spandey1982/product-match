/**
 * Hero-source-mode decision table — decides whether a creative's hero
 * region should reuse an existing catalogue photo, generate a wholly new
 * image, or show the product alone with no model, when the retailer leaves
 * it on "auto".
 *
 * Hard requirement (explicit, from the retailer's own scoping decision —
 * see the plan's Context section): this decision must use ONLY the factors
 * research/catalogue-to-campaign.html actually documents (brand tier,
 * price-visibility, occasion, category, objective, platform) and must
 * NEVER check whether a specific upstream asset (a catalogue photo,
 * GarmentIntelligence) exists — that's hero-resolver.ts's job, which
 * degrades gracefully instead. This function always returns a concrete
 * mode; it never throws and never returns "auto".
 */
import type { BrandTierKey, PriceVisibilityKey } from "@/lib/branding/creative-tier";
import type { ContentMode, CreativeObjective, HeroSourceMode, PlatformHint, RequestedHeroSourceMode } from "./types";

// Categories where research/catalogue-to-campaign.html (Part 1.3) found the
// product/article itself — not a worn/modeled shot — is the dominant,
// evidence-backed convention: jewellery's macro/detail framing, dupattas
// essentially never being a standalone modeled hero, handbags/footwear's
// clean-product-shot track. Matched case-insensitively against
// Product.category, same normalization lib/model-gen/crop-templates.ts's
// resolveCloseUps() already uses for category lookups.
const DETAIL_DRIVEN_CATEGORIES = new Set([
  "jewellery",
  "jewelry",
  "handbag",
  "handbags",
  "bag",
  "footwear",
  "shoes",
  "dupatta",
  "scarf",
  "scarves",
  "accessories",
  "accessory",
]);

export interface HeroSourceDecisionInput {
  requestedMode: RequestedHeroSourceMode;
  brandTier: BrandTierKey;
  priceVisibility: PriceVisibilityKey;
  category: string;
  /** True when the product/campaign carries an occasion signal (e.g.
   * Product.occasion is non-empty, or objective is "seasonal_occasion"). */
  hasOccasionSignal: boolean;
  objective: CreativeObjective;
  contentMode: ContentMode;
  platform?: PlatformHint;
}

export function resolveHeroSourceMode(input: HeroSourceDecisionInput): HeroSourceMode {
  if (input.requestedMode !== "auto") return input.requestedMode;

  const category = input.category.trim().toLowerCase();
  if (DETAIL_DRIVEN_CATEGORIES.has(category)) return "product-only";

  const isPremiumTier = input.brandTier === "luxury" || input.brandTier === "boutique";
  if (isPremiumTier && input.hasOccasionSignal) return "generate-new";

  const isPriceLedMassMarket =
    input.contentMode === "price-led" && input.priceVisibility === "prominent";
  if (isPriceLedMassMarket) return "reuse-catalogue";

  // Default: the cheapest, fastest, deterministic-only path — matches
  // report Part 7's "minimum complexity" phasing principle when no other
  // signal points more specifically.
  return "reuse-catalogue";
}
