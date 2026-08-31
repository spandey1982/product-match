import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startMotionJob } from "@/lib/catalogue-motion/orchestrator";

// POST /api/catalogue-motion/jobs/[id]/start — resolve the director's plan,
// create MotionClip rows, enqueue motion.render jobs, and return immediately.
// Does NOT wait for rendering to finish — the caller polls GET .../jobs/[id]
// for status (rendering happens out-of-process in worker/index.ts).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const job = await db.motionJob.findFirst({ where: { id, userId: session.id } });
    if (!job) {
      return NextResponse.json({ error: "Motion job not found" }, { status: 404 });
    }

    await startMotionJob(id);

    const updated = await db.motionJob.findUnique({
      where: { id },
      include: { clips: { orderBy: { shotIndex: "asc" } } },
    });

    return NextResponse.json({ job: updated });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
