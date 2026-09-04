import { db } from "@/lib/db";

export type AggregateRating = {
  ratingValue: number;
  reviewCount: number;
};

/**
 * Real reviews only — returns null until a product has at least one, so the
 * Product JSON-LD's aggregateRating field is omitted rather than fabricated.
 * See prisma/schema.prisma's Review model doc comment for the "auto-published,
 * no moderation queue" MVP posture this reads against.
 */
export async function getAggregateRating(productId: string): Promise<AggregateRating | null> {
  const result = await db.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  if (result._count._all === 0 || result._avg.rating === null) return null;

  return {
    ratingValue: Math.round(result._avg.rating * 10) / 10,
    reviewCount: result._count._all,
  };
}
