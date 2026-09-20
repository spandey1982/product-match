import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPresenterReelJob } from "@/lib/presenter-reel/orchestrator";

// GET /api/presenter-reel/jobs?productId=... — history list for the studio's
// "Previous generations" panel. Scoped to both productId and the caller's own
// userId (never trust the query param alone for ownership).
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const productId = req.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const jobs = await db.presenterReelJob.findMany({
      where: { productId, userId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/presenter-reel/jobs — create AND enqueue a presenter reel job
// in one call (see orchestrator.ts's header for why this collapses the
// create/start split the catalogue-motion route uses).
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = (await req.json().catch(() => null)) as
      | { productId?: string; personaId?: string; durationSec?: number }
      | null;

    if (!body?.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!body?.personaId) {
      return NextResponse.json({ error: "personaId is required" }, { status: 400 });
    }

    const created = await createPresenterReelJob({
      productId: body.productId,
      userId: session.id,
      personaId: body.personaId,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
    });

    // The orchestrator returns only { id } (its job is create+enqueue, not
    // HTTP response shaping) — re-fetch the full row here so the client
    // gets status/createdAt/retryCount immediately rather than waiting for
    // the first poll 4s later. Same row GET /jobs/[id] would return.
    const job = await db.presenterReelJob.findUnique({ where: { id: created.id } });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: (err as Error).message || "Internal server error" }, { status: 500 });
  }
}
