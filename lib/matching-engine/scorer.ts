import { getCategoryCompatibility } from "./category-rules";
import { getColorCompatibility } from "./color-harmony";
import { generateExplanation } from "./explainer";
import { getConfidenceLabel } from "./confidence";
import { db } from "@/lib/db";
import { parseArray, serializeArray } from "@/lib/serialize";
import type { Product } from "@prisma/client";

export type MatchScore = {
  productId: string;
  matchScore: number;
  categoryScore: number;
  colorScore: number;
  occasionScore: number;
  styleScore: number;
  confidence: number;
  explanation: string;
  explanationTags: string[];
};

const WEIGHTS = {
  category: 0.4,
  color: 0.3,
  occasion: 0.2,
  style: 0.1,
};

function computeOccasionScore(
  sourceOccasions: string[],
  targetOccasions: string[]
): number {
  if (sourceOccasions.length === 0 || targetOccasions.length === 0) return 0.5;
  const src = sourceOccasions.map((o) => o.toLowerCase());
  const tgt = targetOccasions.map((o) => o.toLowerCase());
  const shared = src.filter((o) => tgt.includes(o));
  return shared.length > 0 ? Math.min(1.0, 0.5 + shared.length * 0.25) : 0.2;
}

function computeStyleScore(
  sourceStyles: string[],
  targetStyles: string[]
): number {
  if (sourceStyles.length === 0 || targetStyles.length === 0) return 0.5;
  const src = sourceStyles.map((s) => s.toLowerCase());
  const tgt = targetStyles.map((s) => s.toLowerCase());
  const shared = src.filter((s) => tgt.includes(s));
  return shared.length > 0 ? Math.min(1.0, 0.5 + shared.length * 0.2) : 0.3;
}

export function scoreMatch(source: Product, target: Product): MatchScore {
  // Parse JSON strings from SQLite
  const sourceOccasions = parseArray(source.occasion);
  const targetOccasions = parseArray(target.occasion);
  const sourceStyles = parseArray(source.styleTags);
  const targetStyles = parseArray(target.styleTags);

  const categoryPair = getCategoryCompatibility(source.category, target.category);
  const colorMatch = getColorCompatibility(source.color, target.color);
  const occasionScore = computeOccasionScore(sourceOccasions, targetOccasions);
  const styleScore = computeStyleScore(sourceStyles, targetStyles);

  const matchScore =
    WEIGHTS.category * categoryPair.score +
    WEIGHTS.color * colorMatch.score +
    WEIGHTS.occasion * occasionScore +
    WEIGHTS.style * styleScore;

  const { explanation, tags } = generateExplanation({
    categoryPair,
    colorMatch,
    occasionScore,
    styleScore,
    sourceOccasions,
    targetOccasions,
    sourceStyles,
    targetStyles,
  });

  const confidence = Math.min(0.99, matchScore * 1.05);

  return {
    productId: target.id,
    matchScore: Math.round(matchScore * 100) / 100,
    categoryScore: Math.round(categoryPair.score * 100) / 100,
    colorScore: Math.round(colorMatch.score * 100) / 100,
    occasionScore: Math.round(occasionScore * 100) / 100,
    styleScore: Math.round(styleScore * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    explanation,
    explanationTags: tags,
  };
}

export async function generateRecommendations(
  sourceProductId: string,
  userId: string,
  limit = 12
): Promise<MatchScore[]> {
  const sourceProduct = await db.product.findUnique({
    where: { id: sourceProductId },
  });

  if (!sourceProduct) throw new Error("Product not found");

  const candidates = await db.product.findMany({
    where: {
      userId,
      id: { not: sourceProductId },
      isActive: true,
      inStock: true,
    },
  });

  const scores = candidates
    .map((candidate) => scoreMatch(sourceProduct, candidate))
    .filter((s) => s.matchScore > 0.1)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  // Persist recommendations
  await Promise.allSettled(
    scores.map((score) =>
      db.recommendation.upsert({
        where: {
          sourceProductId_targetProductId: {
            sourceProductId,
            targetProductId: score.productId,
          },
        },
        create: {
          sourceProductId,
          targetProductId: score.productId,
          matchScore: score.matchScore,
          categoryScore: score.categoryScore,
          colorScore: score.colorScore,
          occasionScore: score.occasionScore,
          styleScore: score.styleScore,
          confidence: score.confidence,
          explanation: score.explanation,
          explanationTags: serializeArray(score.explanationTags),
        },
        update: {
          matchScore: score.matchScore,
          categoryScore: score.categoryScore,
          colorScore: score.colorScore,
          occasionScore: score.occasionScore,
          styleScore: score.styleScore,
          confidence: score.confidence,
          explanation: score.explanation,
          explanationTags: serializeArray(score.explanationTags),
        },
      })
    )
  );

  return scores;
}

export async function getStoredRecommendations(
  sourceProductId: string,
  limit = 8
) {
  return db.recommendation.findMany({
    where: { sourceProductId },
    orderBy: { matchScore: "desc" },
    take: limit,
    include: {
      targetProduct: true,
    },
  });
}

export { getConfidenceLabel };
