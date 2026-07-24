import { db } from "@/lib/db";

const PILOT_PRICES: Record<string, number> = {
  metadata_extract: 0.00012,
  garment_intelligence: 0.0025,
  image_gen_1k: 0.05,
  image_gen_2k: 0.07,
  tryon_1k: 0.045,
  fashion_design_analysis: 0.00012,
  fashion_design_gen: 0.05,
  voice_search: 0.00012,
  ai_review: 0.00012,
  auto_catalog_classify: 0.00012,
  auto_catalog_verify: 0.00012,
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
