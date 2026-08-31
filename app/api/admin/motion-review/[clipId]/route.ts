import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueRenderForClip } from "@/lib/catalogue-motion/orchestrator";

// POST /api/admin/motion-review/[clipId] — resolve a manual_review clip.
// Body: { action: "accept" | "reject" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    await requireAdmin();
    const { clipId } = await params;
    const body = (await req.json().catch(() => null)) as { action?: string } | null;

    const clip = await db.motionClip.findUnique({ where: { id: clipId }, include: { qa: true } });
    if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    if (clip.qa?.verdict !== "manual_review") {
      return NextResponse.json({ error: "Clip is not pending manual review" }, { status: 400 });
    }

    if (body?.action === "accept") {
      await db.$transaction([
        db.motionClip.update({ where: { id: clipId }, data: { status: "accepted" } }),
        db.motionQAResult.update({ where: { clipId }, data: { verdict: "accepted" } }),
      ]);
      return NextResponse.json({ ok: true, status: "accepted" });
    }

    if (body?.action === "reject") {
      await db.motionQAResult.update({ where: { clipId }, data: { verdict: "rejected" } });
      // Same bounded-regeneration path the automated reject verdict uses —
      // a human rejection is still worth one more attempt at the same plan,
      // capped by the clip's existing retryCount.
      const updated = await db.motionClip.update({
        where: { id: clipId },
        data: { retryCount: { increment: 1 } },
        select: { retryCount: true },
      });
      if (updated.retryCount > 2) {
        await db.motionClip.update({ where: { id: clipId }, data: { status: "failed", errorMessage: "Rejected by manual review after max retries" } });
      } else {
        await enqueueRenderForClip(clipId);
      }
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    return NextResponse.json({ error: "action must be 'accept' or 'reject'" }, { status: 400 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
