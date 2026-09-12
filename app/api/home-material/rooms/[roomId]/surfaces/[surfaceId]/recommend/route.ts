import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateHmUserSession } from "@/lib/home-material/auth";
import { generateMaterialRecommendations, type MaterialRequirements } from "@/lib/home-material/recommendation";
import { parseArray, serializeArray } from "@/lib/serialize";

async function requireOwnedSurface(roomId: string, surfaceId: string, hmUserId: string) {
  const surface = await db.hmSurface.findUnique({
    where: { id: surfaceId },
    include: { room: { include: { project: true } } },
  });
  if (!surface || surface.roomId !== roomId || surface.room.project.hmUserId !== hmUserId) return null;
  return surface;
}

function serializeRecommendation(r: {
  id: string;
  materialId: string | null;
  score: number;
  confidence: number;
  reasons: string;
  concerns: string;
  explanation: string | null;
  material?: {
    id: string;
    name: string;
    category: string;
    avgCostPerSqftMinInr: number | null;
    avgCostPerSqftMaxInr: number | null;
  } | null;
}) {
  return {
    id: r.id,
    materialId: r.materialId,
    score: r.score,
    confidence: r.confidence,
    reasons: parseArray(r.reasons),
    concerns: parseArray(r.concerns),
    explanation: r.explanation,
    material: r.material ?? null,
  };
}

/** Returns previously computed recommendations for this surface, if any (so a page reload doesn't lose them). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string; surfaceId: string }> }
) {
  const session = await getOrCreateHmUserSession();

  const { roomId, surfaceId } = await params;
  const surface = await requireOwnedSurface(roomId, surfaceId, session.id);
  if (!surface) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recommendations = await db.hmRecommendation.findMany({
    where: { surfaceId, productId: null },
    orderBy: { score: "desc" },
    include: {
      material: {
        select: { id: true, name: true, category: true, avgCostPerSqftMinInr: true, avgCostPerSqftMaxInr: true },
      },
    },
  });

  return NextResponse.json({ recommendations: recommendations.map(serializeRecommendation) });
}

/** Computes fresh recommendations from stated requirements, replacing any previous set for this surface. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; surfaceId: string }> }
) {
  const session = await getOrCreateHmUserSession();

  const { roomId, surfaceId } = await params;
  const surface = await requireOwnedSurface(roomId, surfaceId, session.id);
  if (!surface) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const requirements: MaterialRequirements = {
    wetArea: body.wetArea === true,
    budgetTier: ["budget", "mid", "premium"].includes(body.budgetTier) ? body.budgetTier : "any",
    priority: ["durability", "low_maintenance", "premium_look"].includes(body.priority) ? body.priority : "any",
    preferredCategory: ["paint", "wallpaper", "wall_texture", "wall_panel"].includes(body.preferredCategory)
      ? body.preferredCategory
      : "any",
  };

  const results = generateMaterialRecommendations(requirements);
  // Score-breakdown components (2026-09-10, Decision-layer "why this
  // recommendation" vocabulary) aren't persisted — see
  // MaterialRecommendationResult's doc comment — so keep them here to
  // merge into this POST's own response only, matched by materialId.
  const componentsByMaterialId = new Map(results.map((r) => [r.materialId, r.components]));

  await db.hmRecommendation.deleteMany({ where: { surfaceId, productId: null } });
  await db.hmRecommendation.createMany({
    data: results.map((r) => ({
      surfaceId,
      materialId: r.materialId,
      score: r.score,
      confidence: r.confidence,
      reasons: serializeArray(r.reasons),
      concerns: serializeArray(r.concerns),
      explanation: r.explanation,
    })),
  });

  const stored = await db.hmRecommendation.findMany({
    where: { surfaceId, productId: null },
    orderBy: { score: "desc" },
    include: {
      material: {
        select: { id: true, name: true, category: true, avgCostPerSqftMinInr: true, avgCostPerSqftMaxInr: true },
      },
    },
  });

  return NextResponse.json({
    recommendations: stored.map((r) => ({
      ...serializeRecommendation(r),
      components: r.materialId ? componentsByMaterialId.get(r.materialId) ?? null : null,
    })),
  });
}
