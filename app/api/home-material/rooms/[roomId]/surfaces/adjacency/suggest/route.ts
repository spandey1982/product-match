import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { detectAdjacentWalls, type WallForAdjacencyCheck } from "@/lib/home-material/adjacency-detection";

/**
 * Suggests (never saves) which of the given confirmed walls look
 * physically adjacent — sub-problem A, built 2026-09-10 as "AI suggests,
 * user confirms." The caller (RoomView's AdjacencyMarker) pre-checks the
 * suggested walls in its existing checkbox UI; nothing is persisted until
 * the user still clicks "Mark selected as adjacent," which hits the
 * pre-existing PATCH .../surfaces/adjacency endpoint unchanged.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const { surfaceIds } = await req.json();
  if (!Array.isArray(surfaceIds) || surfaceIds.length < 2 || !surfaceIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Provide at least two surfaceIds to compare" }, { status: 400 });
  }

  const surfaces = await db.hmSurface.findMany({
    where: { id: { in: surfaceIds } },
    include: { room: { include: { project: true } } },
  });
  const allOwned = surfaces.length === surfaceIds.length && surfaces.every((s) => s.roomId === roomId && s.room.project.hmUserId === session.id);
  if (!allOwned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roomImageUrl = surfaces[0].room.imageUrl;
  const walls: WallForAdjacencyCheck[] = [];
  for (const s of surfaces) {
    const geometry = s.geometryData ? JSON.parse(s.geometryData) : null;
    const points = geometry?.points;
    if (!Array.isArray(points) || points.length < 3) continue;
    walls.push({ id: s.id, polygon: points });
  }
  if (walls.length < 2) {
    return NextResponse.json({ error: "These walls don't have a saved outline to compare yet" }, { status: 400 });
  }

  const result = await detectAdjacentWalls(roomImageUrl, walls, session.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
