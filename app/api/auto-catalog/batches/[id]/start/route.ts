import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipeline } from "@/lib/auto-catalog/pipeline";

// POST /api/auto-catalog/batches/[id]/start — kick off pipeline for all items
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const batch = await db.autoCatalogBatch.findFirst({
      where: { id, userId: session.id },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (batch.status === "running") {
      return NextResponse.json({ error: "Batch already running" }, { status: 409 });
    }

    const items = await db.autoCatalogItem.findMany({
      where: { batchId: id, stage: "uploaded" },
      select: { id: true },
    });

    await db.autoCatalogBatch.update({
      where: { id },
      data: { status: "running" },
    });

    // Fire-and-forget — each item runs independently so one failure doesn't block others
    Promise.allSettled(items.map((item) => runPipeline(item.id)))
      .then(async () => {
        await db.autoCatalogBatch.update({
          where: { id },
          data: { status: "completed" },
        });
      })
      .catch(console.error);

    return NextResponse.json({ started: items.length });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
