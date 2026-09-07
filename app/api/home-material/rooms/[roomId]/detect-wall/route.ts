import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { detectWallRegion } from "@/lib/home-material/wall-detection";

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
  if (!result.wallVisible || !result.rect) {
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

  const surface = await db.hmSurface.create({
    data: {
      roomId,
      label: "Wall (AI-detected)",
      geometryData: JSON.stringify(result.rect),
      measurementSource: "ai_estimated",
      measurementConfidence: result.confidence,
    },
  });

  return NextResponse.json({ surface, confidence: result.confidence, notes: result.notes });
}
