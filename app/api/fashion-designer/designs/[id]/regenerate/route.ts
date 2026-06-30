import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDesignPipeline } from "@/lib/fashion-designer/pipeline";

// POST /api/fashion-designer/designs/[id]/regenerate
// Optional body: { title, garmentType } to update design params before re-running
export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => ({})) as { title?: string; garmentType?: string };

    // Reset to uploading stage and clear previous outputs
    await db.fashionDesign.update({
      where: { id },
      data: {
        stage: "uploading",
        ...(body.title ? { title: body.title } : {}),
        ...(body.garmentType ? { garmentType: body.garmentType } : {}),
        fabricAnalysis: null,
        designUnderstanding: null,
        accessoryAnalysis: null,
        generationPlan: null,
        flatFrontUrl: null,
        flatBackUrl: null,
        qualityScore: null,
        failureReason: null,
      },
    });

    await runDesignPipeline(id);

    const updated = await db.fashionDesign.findUnique({
      where: { id },
      include: { assets: true },
    });

    return NextResponse.json({ design: updated });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
