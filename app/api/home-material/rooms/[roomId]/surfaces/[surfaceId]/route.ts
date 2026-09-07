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

/**
 * Re-shape an already-saved wall selection ("change selector shape after
 * it was saved"). Once a human explicitly re-drags and re-saves a shape,
 * it's confirmed by them regardless of how it originated — always written
 * as measurementSource "user_confirmed" here, never "ai_estimated"
 * (Constitution Principle 6: a human-edited shape is a confirmation, not
 * an estimate, even if it started as one).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; surfaceId: string }> }
) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, surfaceId } = await params;
  const surface = await db.hmSurface.findUnique({
    where: { id: surfaceId },
    include: { room: { include: { project: true } } },
  });
  if (!surface || surface.roomId !== roomId || surface.room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { points, label } = await req.json();
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

  const updated = await db.hmSurface.update({
    where: { id: surfaceId },
    data: {
      geometryData: JSON.stringify({ points }),
      measurementSource: "user_confirmed",
      measurementConfidence: null,
      ...(typeof label === "string" ? { label: label.trim() || null } : {}),
    },
  });

  return NextResponse.json({ surface: updated });
}
