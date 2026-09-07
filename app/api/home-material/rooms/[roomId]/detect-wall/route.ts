import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { detectWallRegion } from "@/lib/home-material/wall-detection";

/**
 * Preview only — does NOT persist an HmSurface. The client shows the
 * returned polygon as an editable draft (draggable vertices) and the user
 * confirms via POST .../surfaces once they're happy with it, same as a
 * fully manual selection would. This keeps "AI-detected" and "manually
 * drawn" on one save path instead of two.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await db.hmRoom.findUnique({ where: { id: roomId }, include: { project: true } });
  if (!room || room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await detectWallRegion(room.imageUrl, session.id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (!result.wallVisible || !result.polygon) {
    return NextResponse.json(
      {
        error:
          result.notes ||
          "Couldn't clearly detect a wall in this photo — try a straight-on shot facing the wall, or select it manually.",
        detected: false,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ polygon: result.polygon, confidence: result.confidence, notes: result.notes });
}
