/**
 * Deterministic (zero-LLM) content for the "hook_end_card" delivery mode's
 * static end card — price, feature bullets, and the CTA are always computed
 * straight from real product/Garment-Intelligence data, never generated
 * text. Same discipline as the marketing-image feature's copy.ts: a
 * hallucinated price or fabric claim on an AI-disclosed clip is a trust
 * problem, not a copywriting nicety — see research/
 * presenter-reel-content-strategy.html's "never let generative AI render
 * factual pixels" reference. Also resolves the card's title typeface mood
 * (typography-mood.ts) here, since both it and the bullets need the same
 * parsed GI row — one fetch, not two.
 */
import { db } from "@/lib/db";
import type { GarmentIntelligence } from "@/lib/garment-intelligence/types";
import type { CtaMode } from "./duration-budget";
import { inferVisualMood, type VisualMood } from "./typography-mood";

export interface EndCardContent {
  headline: string;
  bullets: string[];
  price: { amount: number; mrp: number | null; discountPercent: number | null } | null;
  ctaText: string | null;
  mood: VisualMood;
}

export interface EndCardProductInput {
  id: string;
  userId: string;
  title: string;
  price: number;
  mrpPrice: number | null;
  discountPercent: number | null;
  material?: string | null;
  pattern?: string | null;
}

const MAX_BULLETS = 3;

/** Same try/catch-and-degrade parse pattern as lib/catalogue-motion/reel/pattern-risk.ts's assessPatternRisk — a malformed or missing GI row is a normal, expected case (not every product has been through cataloguing analysis), not an error. */
async function fetchGiData(productId: string): Promise<GarmentIntelligence | null> {
  const gi = await db.garmentIntelligence.findUnique({ where: { productId }, select: { data: true } });
  if (!gi) return null;
  try {
    return JSON.parse(gi.data) as GarmentIntelligence;
  } catch {
    return null;
  }
}

export async function buildEndCardContent(
  product: EndCardProductInput,
  ctaMode: CtaMode,
  ctaText: string | null
): Promise<EndCardContent> {
  const giData = await fetchGiData(product.id);
  const giHighlights = (giData?.craftsmanship?.highlights ?? []).filter((h) => h.trim().length > 0);
  const bullets =
    giHighlights.length > 0
      ? giHighlights.slice(0, MAX_BULLETS)
      : [product.pattern, product.material]
          .filter((v): v is string => Boolean(v && v.trim().length > 0))
          .slice(0, MAX_BULLETS);

  const mood = await inferVisualMood({
    userId: product.userId,
    price: product.price,
    giData: giData ? { craftsmanship: giData.craftsmanship } : null,
  });

  return {
    headline: product.title,
    bullets,
    price: { amount: product.price, mrp: product.mrpPrice, discountPercent: product.discountPercent },
    ctaText: ctaMode === "none" ? null : ctaText,
    mood,
  };
}
