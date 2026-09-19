import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateHmUserSession } from "@/lib/home-material/auth";
import { detectWallRegion } from "@/lib/home-material/wall-detection";

/**
 * Preview only — does NOT persist an HmSurface. Returns every independent
 * wall candidate detected in the photo (lightweight multi-wall, 2026-09-09
 * — no perspective-correction or cross-wall continuity guarantee, see
 * lib/home-material/wall-detection.ts). The client shows each candidate
 * polygon and lets the user pick one at a time as an editable draft
 * (draggable vertices), confirming via POST .../surfaces just like a
 * fully manual selection would — remaining candidates stay pickable for
 * additional walls in the same photo. This keeps "AI-detected" and
 * "manually drawn" on one save path instead of two.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getOrCreateHmUserSession();

  const { roomId } = await params;
  const room = await db.hmRoom.findUnique({ where: { id: roomId }, include: { project: true } });
  if (!room || room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await detectWallRegion(room.imageUrl, session.id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (!result.wallVisible || result.candidates.length === 0) {
    return NextResponse.json(
      {
        error:
          result.notes ||
          "Couldn't clearly detect a wall in this photo — try a straight-on shot facing the wall(s), or select it manually.",
        detected: false,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ walls: result.candidates, notes: result.notes });
}
