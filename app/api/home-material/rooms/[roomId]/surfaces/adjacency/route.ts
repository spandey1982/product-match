import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * Marks (or clears) walls as physically adjacent — the ONLY input the
 * sheet-count calculation (lib/home-material/sheet-calculation.ts) trusts
 * for combining walls into one continuous run. Deliberately manual, not
 * AI-detected (2026-09-09) — see HmSurface.adjacencyGroupId's doc comment
 * for why: auto-detecting real adjacency from a photo is sub-problem A
 * from the multi-wall discussion, explicitly paused pending its own
 * dedicated conversation.
 *
 * 2+ surfaceIds: groups them all under one new shared adjacencyGroupId
 * (replacing whatever group each was in before). Exactly 1 surfaceId:
 * removes it from any group (sets adjacencyGroupId to null).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const { surfaceIds } = await req.json();
  if (!Array.isArray(surfaceIds) || surfaceIds.length === 0 || !surfaceIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Provide at least one surfaceId" }, { status: 400 });
  }

  const surfaces = await db.hmSurface.findMany({
    where: { id: { in: surfaceIds } },
    include: { room: { include: { project: true } } },
  });
  const allOwned = surfaces.length === surfaceIds.length && surfaces.every((s) => s.roomId === roomId && s.room.project.hmUserId === session.id);
  if (!allOwned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (surfaceIds.length === 1) {
    await db.hmSurface.update({ where: { id: surfaceIds[0] }, data: { adjacencyGroupId: null } });
  } else {
    const groupId = randomUUID();
    await db.hmSurface.updateMany({ where: { id: { in: surfaceIds } }, data: { adjacencyGroupId: groupId } });
  }

  const updated = await db.hmSurface.findMany({ where: { roomId } });
  return NextResponse.json({ surfaces: updated });
}
