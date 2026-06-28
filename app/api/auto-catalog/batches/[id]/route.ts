import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/auto-catalog/batches/[id] — update batch status (e.g. mark completed)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json() as { status?: string };

    const batch = await db.autoCatalogBatch.findFirst({
      where: { id, userId: session.id },
    });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const updated = await db.autoCatalogBatch.update({
      where: { id },
      data: { ...(body.status ? { status: body.status } : {}) },
    });

    return NextResponse.json({ batch: updated });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/auto-catalog/batches/[id] — poll batch + all items
export async function GET(
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

    const items = await db.autoCatalogItem.findMany({
      where: { batchId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ batch, items });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
