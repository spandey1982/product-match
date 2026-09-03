import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMotionJob } from "@/lib/catalogue-motion/orchestrator";
import { isMotionIntensity } from "@/lib/catalogue-motion/constraints";

// POST /api/catalogue-motion/jobs — create a motion job (does not start it)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = (await req.json().catch(() => null)) as
      | { productId?: string; intensity?: string; provider?: string }
      | null;

    const productId = body?.productId;
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const product = await db.product.findFirst({ where: { id: productId, userId: session.id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const intensity = body?.intensity && isMotionIntensity(body.intensity) ? body.intensity : undefined;
    const job = await createMotionJob({
      productId,
      userId: session.id,
      intensity,
      provider: body?.provider === "kling" ? "kling" : undefined,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/catalogue-motion/jobs — list this retailer's motion jobs
export async function GET() {
  try {
    const session = await requireAuth();
    const jobs = await db.motionJob.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ jobs });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
