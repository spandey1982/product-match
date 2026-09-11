import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * Sets (or clears) a wall's real-world dimensions — the mitigation for
 * "possiblyTruncated" walls (2026-09-09): the photo alone can't tell the
 * system a wall's true length when the camera didn't capture the whole
 * thing, so this lets the user supply the real fact instead. Always
 * optional, never blocking (see docs/home-material/README.md) — a wall
 * with no dimensions set just falls back to estimating from the visible
 * photo portion only, same as before this existed.
 *
 * Separate from the shape-reshape PATCH at .../surfaces/[surfaceId] on
 * purpose: that endpoint always requires `points` (it's a re-trace), and
 * dimension entry is an orthogonal fact about the physical wall, not the
 * traced outline.
 */
function parseDimension(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

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

  const { widthMeters, heightMeters } = await req.json();
  const w = parseDimension(widthMeters);
  const h = parseDimension(heightMeters);

  if ((widthMeters !== null && widthMeters !== undefined && w === null) || (heightMeters !== null && heightMeters !== undefined && h === null)) {
    return NextResponse.json({ error: "Width and height must be positive numbers" }, { status: 400 });
  }

  const updated = await db.hmSurface.update({
    where: { id: surfaceId },
    data: {
      widthMeters: w,
      heightMeters: h,
      areaSqm: w !== null && h !== null ? w * h : null,
    },
  });

  return NextResponse.json({ surface: updated });
}
