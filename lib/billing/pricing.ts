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

