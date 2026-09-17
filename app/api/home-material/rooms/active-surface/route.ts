import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * Read-only lookup: does this visitor already have a room with at least
 * one confirmed wall? Used by the browse page's product "preview" (eye)
 * icon (see MaterialsLandingClient.tsx) to decide whether clicking a
 * product should jump straight into that existing room — auto-selecting
 * the product on its most recently confirmed wall and generating a room
 * trial immediately — or fall back to the "upload your room" flow for a
 * first-time visitor who has nothing to preview on yet.
 *
 * Deliberately uses getHmUserSession() (read-only), not
 * getOrCreateHmUserSession() — same reasoning as HmNavBar.tsx: a visitor
 * who has never uploaded a room shouldn't get a guest HmUser row
 * provisioned just to learn the (obvious) answer "no room yet."
 *
 * "Confirmed" means geometryData is set (the wall outline has been traced
 * and saved) — same marker ConfirmedWallOutline/ui/decisions.md already
 * use elsewhere. Picks the single most recently confirmed wall across
 * every room, matching the nav bar's existing "most recent room" V1
 * convention (no room-list page exists yet).
 */
export async function GET() {
  const session = await getHmUserSession();
  if (!session) return NextResponse.json({ roomId: null, surfaceId: null });

  const surface = await db.hmSurface.findFirst({
    where: { geometryData: { not: null }, room: { project: { hmUserId: session.id } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, roomId: true },
  });

  return NextResponse.json({ roomId: surface?.roomId ?? null, surfaceId: surface?.id ?? null });
}
