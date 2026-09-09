import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

const MIN_POINTS = 3;
const MAX_POINTS = 12;

function polygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

/** Optional 4-point perspective quad (sub-problem B, 2026-09-09) — validated the same way as the outline polygon; malformed input is dropped to null rather than rejecting the whole save (this is a bonus precision feature, not a required field). */
function parseCorners(raw: unknown): { x: number; y: number }[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  if (!raw.every((p) => typeof p?.x === "number" && typeof p?.y === "number" && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) return null;
  const points = raw.map((p) => ({ x: p.x, y: p.y }));
  return polygonArea(points) > 0.01 ? points : null;
}

/**
 * Single "confirm and save" path for a wall selection — whether the points
 * came from AI detection (POST .../detect-wall, then possibly dragged by
 * the user) or fully manual click-to-place. Either way the client sends
 * the FINAL point set here. measurementSource distinguishes them:
 * "ai_estimated" if the points trace back to a detection the user accepted
 * as-is or adjusted, "user_confirmed" for a from-scratch manual draw
 * (Constitution Principle 6 — never blur that distinction).
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

  const { points, label, measurementSource, measurementConfidence, corners, possiblyTruncated } = await req.json();

  if (
    !Array.isArray(points) ||
    points.length < MIN_POINTS ||
    points.length > MAX_POINTS ||
    !points.every((p) => typeof p?.x === "number" && typeof p?.y === "number" && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
  ) {
    return NextResponse.json(
      { error: `Provide ${MIN_POINTS}-${MAX_POINTS} points, each with x/y between 0 and 1` },
      { status: 400 }
    );
  }
  if (polygonArea(points) < 0.01) {
    return NextResponse.json({ error: "This selection is too small — try covering more of the wall" }, { status: 400 });
  }

  const source = measurementSource === "ai_estimated" ? "ai_estimated" : "user_confirmed";
  const validCorners = parseCorners(corners);

  const surface = await db.hmSurface.create({
    data: {
      roomId,
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      geometryData: JSON.stringify(validCorners ? { points, corners: validCorners } : { points }),
      measurementSource: source,
      measurementConfidence: source === "ai_estimated" && typeof measurementConfidence === "number" ? measurementConfidence : null,
      // Only trust the AI's own judgment — a manual/from-scratch trace
      // has no such signal, so it defaults to false (schema default)
      // rather than flagging something no model ever assessed.
      possiblyTruncated: source === "ai_estimated" && possiblyTruncated === true,
    },
  });

  return NextResponse.json({ surface });
}
