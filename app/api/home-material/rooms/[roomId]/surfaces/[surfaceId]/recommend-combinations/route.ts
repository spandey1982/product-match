import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { generateSameWallCombinations } from "@/lib/home-material/combination-recommendation";
import type { MaterialRequirements } from "@/lib/home-material/recommendation";

/**
 * Same-wall layered material combinations (sub-problem F, 2026-09-10) —
 * e.g. paint + wainscoting on ONE wall. Ephemeral: computed fresh from
 * stated requirements and returned directly, never persisted (see
 * lib/home-material/combination-recommendation.ts's file header for why).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string; surfaceId: string }> }) {
  const session = await getHmUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId, surfaceId } = await params;
  const surface = await db.hmSurface.findUnique({
    where: { id: surfaceId },
    include: { room: { include: { project: true } } },
  });
  if (!surface || surface.roomId !== roomId || surface.room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const requirements: MaterialRequirements = {
    wetArea: body.wetArea === true,
    budgetTier: ["budget", "mid", "premium"].includes(body.budgetTier) ? body.budgetTier : "any",
    priority: ["durability", "low_maintenance", "premium_look"].includes(body.priority) ? body.priority : "any",
    preferredCategory: ["paint", "wallpaper", "wall_texture", "wall_panel"].includes(body.preferredCategory)
      ? body.preferredCategory
      : "any",
  };

  const combinations = generateSameWallCombinations(requirements);
  return NextResponse.json({ combinations });
}
