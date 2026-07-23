import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDesignPipeline } from "@/lib/fashion-designer/pipeline";
import { withCreditCheck } from "@/lib/billing/credit-check";
import type { BillingOperation } from "@/lib/billing/types";

function estimateDesignPipelineOps(): BillingOperation[] {
  return [
    "fashion_design_analysis",
    "fashion_design_analysis",
    "fashion_design_analysis",
    "fashion_design_analysis",
    "fashion_design_gen",
    "fashion_design_gen",
  ];
}

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

    const creditResult = await withCreditCheck(
      session.id,
      estimateDesignPipelineOps(),
      async () => {
        await runDesignPipeline(id);
      }
    );

    if ("insufficientCredits" in creditResult) {
      return NextResponse.json({
        error: "insufficient_credits",
        message: "Not enough credits to run the design pipeline. Contact your admin to add more credits.",
        remainingPercentage: creditResult.remainingPercentage,
      }, { status: 402 });
    }

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
