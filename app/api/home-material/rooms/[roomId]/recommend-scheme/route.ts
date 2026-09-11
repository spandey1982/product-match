import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { generateRoomScheme } from "@/lib/home-material/combination-recommendation";
import type { MaterialRequirements } from "@/lib/home-material/recommendation";

/**
 * Cross-wall ROOM material scheme (sub-problem F, 2026-09-10) — one
 * feature wall + a complementary paint for the rest of the room's
 * confirmed walls. Ephemeral, same as the same-wall combinations endpoint
 * — see lib/home-material/combination-recommendation.ts's file header.
 * Needs 2+ confirmed walls in the room to mean anything.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const session = await getHmUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const room = await db.hmRoom.findUnique({
    where: { id: roomId },
    include: { project: true, surfaces: true },
  });
  if (!room || room.project.hmUserId !== session.id) {
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

  const scheme = generateRoomScheme(requirements, room.surfaces.length);
  if (!scheme) {
    return NextResponse.json({ error: "Need at least 2 confirmed walls in this room for a room-wide scheme." }, { status: 400 });
  }

  return NextResponse.json({ scheme });
}
