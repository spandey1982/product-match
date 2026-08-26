import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithModule } from "@/lib/client-modules-server";
import { db } from "@/lib/db";
import { runPipeline } from "@/lib/auto-catalog/pipeline";

// POST /api/auto-catalog/items/[id]/process — runs pipeline for one item synchronously
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthWithModule("auto-catalog");
    const { id } = await params;

    const item = await db.autoCatalogItem.findFirst({
      where: { id, userId: session.id },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await runPipeline(id);

    const updated = await db.autoCatalogItem.findUnique({ where: { id } });
    return NextResponse.json({ item: updated });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((err as Error).message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
