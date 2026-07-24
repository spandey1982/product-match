import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDesignPipeline } from "@/lib/fashion-designer/pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const design = await db.fashionDesign.findFirst({
      where: { id, userId: session.id },
    });

    if (!design) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    await runDesignPipeline(id, session.id);

    const updated = await db.fashionDesign.findUnique({
      where: { id },
      include: { assets: true },
    });

    if (updated?.stage === "failed" && updated.failureReason?.includes("Insufficient credits")) {
      return NextResponse.json({
        error: "insufficient_credits",
        message: updated.failureReason,
      }, { status: 402 });
    }

    return NextResponse.json({ design: updated });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
