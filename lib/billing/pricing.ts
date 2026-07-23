import { db } from "@/lib/db";
import type { BillingOperation } from "./types";

interface PricingConfigRow {
  id: string;
  name: string;
  prices: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isActive: boolean;
}

export interface ResolvedPricing {
  configId: string;
  configName: string;
  prices: Record<string, number>;
}

export async function getActivePricingConfig(): Promise<ResolvedPricing | null> {
  const now = new Date();

  const config = await db.pricingConfig.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [
        { effectiveUntil: null },
        { effectiveUntil: { gt: now } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  }) as PricingConfigRow | null;

  if (!config) return null;

  const prices = JSON.parse(config.prices) as Record<string, number>;
  return { configId: config.id, configName: config.name, prices };
}

export function getRetailPrice(
  pricing: ResolvedPricing,
  operation: BillingOperation
): number | null {
  return pricing.prices[operation] ?? null;
}

export function sumRetailPrices(
  pricing: ResolvedPricing,
  operations: BillingOperation[]
): number {
  let total = 0;
  for (const op of operations) {
    const price = pricing.prices[op];
    if (price != null) total += price;
  }
  return total;
}

export function mapToBillingOp(
  feature: string,
  model: string,
  quality?: string | null
): BillingOperation {
  if (model === "gemini-3.1-flash-image") {
    if (feature === "fashion_designer") return "fashion_design_gen";
    return quality === "enhanced" ? "image_gen_2k" : "image_gen_1k";
  }

  if (model === "virtual-try-on-001") return "tryon_1k";

  switch (feature) {
    case "garment_intelligence":
      return "garment_intelligence";
    case "metadata_extract":
    case "detail_extract":
      return "metadata_extract";
    case "tryon":
      return "tryon_1k";
    case "fashion_designer":
      return "fashion_design_analysis";
    case "voice_search":
      return "voice_search";
    case "ai_review":
      return "ai_review";
    case "auto_catalog":
      return "auto_catalog_classify";
    default:
      return "metadata_extract";
  }
}
