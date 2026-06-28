import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/auto-catalog/items/[id]/retry — resets a failed item to uploaded so
// the UI can call /process again from the beginning.
export async function POST(
  _req: NextRequest,
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

    if (item.stage !== "failed") {
      return NextResponse.json({ error: "Only failed items can be retried" }, { status: 400 });
    }

    await db.autoCatalogItem.update({
      where: { id },
      data: {
        stage: "uploaded",
        failureReason: null,
        retryCount: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
