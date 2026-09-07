import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * V1 has no CV wall-detection yet (locked decision, 2026-09-07 — see
 * docs/home-material/README.md) — the user draws the wall region directly,
 * as a fractional rect {x, y, width, height} in [0,1] relative to the room
 * image. Since no AI estimate is involved at all in this path,
 * measurementSource is "user_confirmed", not the schema's "ai_estimated"
 * default (Constitution Principle 6 — never overstate what's actually
 * known: this is a selected region, not a physical measurement, so
 * widthMeters/heightMeters/areaSqm stay unset).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await db.hmRoom.findUnique({
    where: { id: roomId },
    include: { project: true },
  });
  if (!room || room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { x, y, width, height, label } = await req.json();
  const nums = [x, y, width, height];
  if (nums.some((n) => typeof n !== "number" || Number.isNaN(n) || n < 0 || n > 1)) {
    return NextResponse.json({ error: "x, y, width, height must be numbers between 0 and 1" }, { status: 400 });
  }
  if (width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    return NextResponse.json({ error: "Selection is out of bounds" }, { status: 400 });
  }

  const surface = await db.hmSurface.create({
    data: {
      roomId,
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      geometryData: JSON.stringify({ x, y, width, height }),
      measurementSource: "user_confirmed",
    },
  });

  return NextResponse.json({ surface });
}
