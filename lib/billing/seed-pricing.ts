import { db } from "@/lib/db";

/**
 * Retail prices in credits (1 credit = Rs 10; see lib/billing/exchange.ts).
 * Major generation operations sit on a simple 0.5-credit progression;
 * cheap utility/classification calls are free (0) except garment_intelligence,
 * which is deliberately priced so 4 calls cost 1 credit total (0.25 each) —
 * see the 2026-09-16 credits pricing redesign.
 */
const PILOT_PRICES: Record<string, number> = {
  metadata_extract: 0,
  garment_intelligence: 0.25,
  image_gen_1k: 1.5,
  image_gen_2k: 2.0,
  vai_image_gen: 1.0,
  tryon_1k: 1.0,
  fashion_design_analysis: 0,
  fashion_design_gen: 1.5,
  voice_search: 0,
  ai_review: 0,
  auto_catalog_classify: 0,
  auto_catalog_verify: 0,
  erase: 1.5,
  motion_clip: 1.0,
  motion_compose: 0,
};

export async function seedPilotPricing(adminUserId: string) {
  const existing = await db.pricingConfig.findFirst({
    where: { isActive: true },
  });

  if (existing) {
    console.log("[seed-pricing] Active pricing config already exists, skipping.");
    return existing;
  }

  const config = await db.pricingConfig.create({
    data: {
      name: "Pilot Launch Pricing",
      prices: JSON.stringify(PILOT_PRICES),
      effectiveFrom: new Date(),
      isActive: true,
      createdBy: adminUserId,
    },
  });

  console.log("[seed-pricing] Created pilot pricing config:", config.id);
  return config;
}
