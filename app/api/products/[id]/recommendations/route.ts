import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  generateRecommendations,
  getStoredRecommendations,
} from "@/lib/matching-engine/scorer";
import { deserializeProduct, parseArray } from "@/lib/serialize";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "true";
    const limit = parseInt(searchParams.get("limit") || "8");

    if (refresh) {
      await generateRecommendations(id, session.id, limit);
    }

    // Always fetch stored (with product included) for consistent response
    const stored = await getStoredRecommendations(id, limit);

    if (stored.length === 0 && !refresh) {
      // Generate on first visit
      await generateRecommendations(id, session.id, limit);
      const fresh = await getStoredRecommendations(id, limit);
      return NextResponse.json({
        recommendations: fresh.map(formatRec),
        fresh: true,
      });
    }

    return NextResponse.json({
      recommendations: stored.map(formatRec),
      fresh: refresh,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatRec(r: {
  targetProductId: string;
  matchScore: number;
  categoryScore: number;
  colorScore: number;
  occasionScore: number;
  styleScore: number;
  confidence: number;
  explanation: string;
  explanationTags: string;
  targetProduct: Record<string, unknown>;
}) {
  return {
    productId: r.targetProductId,
    matchScore: r.matchScore,
    categoryScore: r.categoryScore,
    colorScore: r.colorScore,
    occasionScore: r.occasionScore,
    styleScore: r.styleScore,
    confidence: r.confidence,
    explanation: r.explanation,
    explanationTags: parseArray(r.explanationTags),
    product: deserializeProduct(r.targetProduct),
  };
}
