/**
 * Deterministic "heritage" vs "contemporary" mood, used only to pick the
 * end card's title typeface (Playfair Display vs Fraunces — see fonts.ts).
 * Never asked of the model or the retailer — inferred from data already
 * extracted at cataloguing time, same "never let generative AI render a
 * fact" discipline research/presenter-reel-content-strategy.html applies
 * to this layout decision. Craftsmanship complexity is the primary signal
 * (visible, and a reliable proxy for value in ethnic wear specifically);
 * price is only a tie-breaker for the ambiguous "moderate density" case,
 * and computed relative to the retailer's OWN catalogue rather than a
 * fixed rupee figure, since an absolute threshold would misjudge a
 * retailer whose whole catalogue sits unusually high or low.
 *
 * Occasion tags (wedding/festive) were tried as a third signal and
 * REMOVED after testing against real cataloged products: a plain,
 * non-handcrafted, solid-color suit tagged "wedding, party" (a real
 * product in this catalogue) resolved to "heritage" purely on that tag —
 * a formal-occasion garment isn't necessarily a visually ornate one, so
 * occasion is too coarse a signal for this specific decision. Left out
 * deliberately, not an oversight.
 *
 * overallDensity is matched by substring/pattern, not strict equality —
 * also found via real-data testing: real GI rows carry values like "Dense
 * on borders and pallu, medium on the body", not always the clean
 * "heavy"/"moderate"/"minimal" the type comment implies. An exact-match
 * check silently missed that case.
 */
import { db } from "@/lib/db";
import type { GarmentIntelligence } from "@/lib/garment-intelligence/types";

export type VisualMood = "heritage" | "contemporary";

const DENSE_PATTERN = /heavy|dense/i;
const MODERATE_PATTERN = /moderate|medium/i;
/** A product priced above this fraction of its own retailer's catalogue counts as "high value" for the tie-break. */
const TOP_QUARTILE_THRESHOLD = 0.75;

async function isInRetailerTopQuartile(userId: string, price: number): Promise<boolean> {
  const [lowerCount, totalCount] = await Promise.all([
    db.product.count({ where: { userId, price: { lt: price } } }),
    db.product.count({ where: { userId } }),
  ]);
  if (totalCount === 0) return false;
  return lowerCount / totalCount >= TOP_QUARTILE_THRESHOLD;
}

export interface MoodInput {
  userId: string;
  price: number;
  giData: Pick<GarmentIntelligence, "craftsmanship"> | null;
}

export async function inferVisualMood(input: MoodInput): Promise<VisualMood> {
  const craftsmanship = input.giData?.craftsmanship;
  const density = craftsmanship?.overallDensity ?? "";

  if (craftsmanship?.handcrafted) return "heritage";
  if (DENSE_PATTERN.test(density)) return "heritage";

  if (MODERATE_PATTERN.test(density)) {
    const highValue = await isInRetailerTopQuartile(input.userId, input.price);
    if (highValue) return "heritage";
  }

  return "contemporary";
}
