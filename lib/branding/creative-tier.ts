/**
 * Closed sets for the Brand Creative Profile fields on ClientProfile
 * (brandTier, priceVisibility) — same posture as THEME_PRESETS in
 * lib/branding/presets.ts: Mentis-curated, never freeform, enforced by a
 * runtime type guard rather than a Prisma enum (this schema uses plain
 * String columns for every closed-set field). See
 * research/catalogue-to-campaign.html Part 5.2 for the research behind
 * these two fields specifically.
 */

export const BRAND_TIERS = [
  "luxury",
  "mid-market",
  "mass-market",
  "boutique",
  "genz-native",
] as const;

export type BrandTierKey = (typeof BRAND_TIERS)[number];

export function isBrandTierKey(value: string): value is BrandTierKey {
  return (BRAND_TIERS as readonly string[]).includes(value);
}

export const PRICE_VISIBILITIES = ["suppressed", "moderate", "prominent"] as const;

export type PriceVisibilityKey = (typeof PRICE_VISIBILITIES)[number];

export function isPriceVisibilityKey(value: string): value is PriceVisibilityKey {
  return (PRICE_VISIBILITIES as readonly string[]).includes(value);
}

export interface BrandCreativeProfile {
  brandTier: BrandTierKey;
  priceVisibility: PriceVisibilityKey;
}

/**
 * Resolves a ClientProfile's creative-tier fields into a concrete, always-
 * valid BrandCreativeProfile — defends against a stale/bad stored value the
 * same way resolveBrandTheme() does for themePreset, and returns the same
 * defaults the schema column itself defaults to when no ClientProfile row
 * exists for the account at all.
 */
export function resolveBrandCreativeProfile(
  profile: { brandTier: string; priceVisibility: string } | null
): BrandCreativeProfile {
  return {
    brandTier: profile && isBrandTierKey(profile.brandTier) ? profile.brandTier : "mid-market",
    priceVisibility:
      profile && isPriceVisibilityKey(profile.priceVisibility) ? profile.priceVisibility : "moderate",
  };
}
