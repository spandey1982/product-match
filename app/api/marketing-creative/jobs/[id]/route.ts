import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/marketing-creative/jobs/[id] — poll job status. Single row,
// single lifecycle (like PresenterReelJob) — no sub-rows to include.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const job = await db.marketingCreativeJob.findFirst({
      where: { id, userId: session.id },
    });

    if (!job) {
      return NextResponse.json({ error: "Marketing creative job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
