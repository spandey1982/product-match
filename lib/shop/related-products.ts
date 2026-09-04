import { db } from "@/lib/db";
import { scoreMatch } from "@/lib/matching-engine/scorer";
import { toPublicShopProduct, type PublicShopProduct } from "@/lib/shop/public-product";
import type { Product as PrismaProduct } from "@prisma/client";

export type RelatedProduct = PublicShopProduct & {
  matchScore: number;
  explanation: string;
};

// Bounds how many active/in-stock candidates get scored per page view. The
// matching engine's scorer is a cheap pure function (no I/O), so this is a
// query-size guard, not a scoring-cost one — raise it if the live catalog
// grows well past a few hundred products and match quality needs the wider
// pool.
const CANDIDATE_POOL_SIZE = 500;

/**
 * Public, marketplace-wide "people also buy" — reuses the matching engine's
 * exported scoreMatch() (lib/matching-engine/scorer.ts, untouched here) but,
 * unlike generateRecommendations(), is NOT scoped to one retailer's userId:
 * /shop is one shared marketplace across every retailer (same posture as
 * lib/shop/public-product.ts), so candidates span all active, in-stock
 * products site-wide. Deliberately does not filter by category — the engine
 * is built to score cross-category pairings (e.g. Saree -> Blouse) highly,
 * so a same-category-only prefilter would defeat the point.
 */
export async function getRelatedProducts(
  sourceProduct: PrismaProduct,
  limit = 8
): Promise<RelatedProduct[]> {
  const candidates = await db.product.findMany({
    where: {
      id: { not: sourceProduct.id },
      isActive: true,
      inStock: true,
    },
    take: CANDIDATE_POOL_SIZE,
    include: {
      generatedImages: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
    },
  });

  return candidates
    .map((candidate) => {
      const score = scoreMatch(sourceProduct, candidate);
      return { candidate, score };
    })
    .filter(({ score }) => score.matchScore > 0.1)
    .sort((a, b) => b.score.matchScore - a.score.matchScore)
    .slice(0, limit)
    .map(({ candidate, score }) => ({
      ...toPublicShopProduct(candidate as unknown as Record<string, unknown>),
      matchScore: score.matchScore,
      explanation: score.explanation,
    }));
}
