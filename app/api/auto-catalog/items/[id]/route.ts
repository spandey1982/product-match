import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipeline } from "@/lib/auto-catalog/pipeline";

// PATCH /api/auto-catalog/items/[id] — manual QC edits or category assignment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const item = await db.autoCatalogItem.findFirst({
      where: { id, userId: session.id },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await req.json() as {
      category?: string;
      catalogResult?: string;
      stage?: string;
    };

    const updates: Record<string, unknown> = {};

    // Category assignment for unknown items — resumes the pipeline
    if (body.category && item.stage === "unknown") {
      const classification = item.classificationResult
        ? JSON.parse(item.classificationResult)
        : {};
      classification.category = body.category;
      classification.confidence = 0.95; // merchant override = high confidence
      updates.classificationResult = JSON.stringify(classification);
      updates.stage = "uploaded"; // reset so pipeline picks it up
    }

    // Manual catalog field overrides from the manual QC queue
    if (body.catalogResult) {
      updates.catalogResult = body.catalogResult;
    }

    await db.autoCatalogItem.update({ where: { id }, data: updates });

    // If category was just assigned, resume the pipeline
    if (body.category && item.stage === "unknown") {
      runPipeline(id).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/auto-catalog/items/[id]/approve — approve from manual QC
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const item = await db.autoCatalogItem.findFirst({
      where: { id, userId: session.id, stage: "manual_qc" },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found or not in manual QC" }, { status: 404 });
    }

    if (!item.productId) {
      return NextResponse.json({ error: "No product linked to this item" }, { status: 400 });
    }

    // Publish the draft product
    await db.product.update({
      where: { id: item.productId },
      data: { isActive: true },
    });

    await db.autoCatalogItem.update({
      where: { id },
      data: { stage: "published" },
    });

    await db.autoCatalogBatch.update({
      where: { id: item.batchId },
      data: {
        manualQcCount: { decrement: 1 },
        publishedCount: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true, productId: item.productId });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
