import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/fashion-designer/designs/[id]/cancel
// Sets cancelRequested = true; the pipeline checks this between stages and stops.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const design = await db.fashionDesign.findFirst({ where: { id, userId: session.id } });
    if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });

    await db.fashionDesign.update({
      where: { id },
      data: { cancelRequested: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
