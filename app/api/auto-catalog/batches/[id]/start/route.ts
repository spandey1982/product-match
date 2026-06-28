import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/auto-catalog/batches/[id]/start — marks batch as running and returns item ids
// The UI is responsible for calling /api/auto-catalog/items/[id]/process for each item.
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

    return NextResponse.json({ started: items.length, itemIds: items.map((i) => i.id) });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
