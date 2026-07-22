import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDesignPipeline } from "@/lib/fashion-designer/pipeline";
import { findTemplate } from "@/lib/fashion-designer/templates";
import { withCreditCheck } from "@/lib/billing/credit-check";
import type { BillingOperation } from "@/lib/billing/types";

// POST /api/fashion-designer/designs/[id]/regenerate
// Optional body: { title, garmentType, templateId, structuredOptions, designNotes }
// to update design params before re-running.
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

    const body = await req.json().catch(() => ({})) as {
      title?: string;
      garmentType?: string;
      templateId?: string | null;
      structuredOptions?: Record<string, string>;
      designNotes?: string;
    };

    const garmentType = body.garmentType ?? design.garmentType;

    let templateUpdate: { templateId: string | null; structuredOptions: string | null } | null = null;
    if (body.templateId !== undefined) {
      const template = body.templateId ? findTemplate(body.templateId) : null;
      if (body.templateId && (!template || template.garmentCategory !== garmentType)) {
        return NextResponse.json({ error: "Invalid templateId for garment type" }, { status: 400 });
      }
      let structuredOptions: string | null = null;
      if (template && body.structuredOptions && typeof body.structuredOptions === "object") {
        const validKeys = new Set(template.fields.map((f) => f.key));
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(body.structuredOptions)) {
          if (validKeys.has(k) && typeof v === "string") cleaned[k] = v;
        }
        structuredOptions = JSON.stringify(cleaned);
      }
      templateUpdate = { templateId: body.templateId ?? null, structuredOptions };
    }

    // Reset to uploading stage and clear previous outputs
    await db.fashionDesign.update({
      where: { id },
      data: {
        stage: "uploading",
        ...(body.title ? { title: body.title } : {}),
        ...(body.garmentType ? { garmentType: body.garmentType } : {}),
        ...(templateUpdate ?? {}),
        ...(body.designNotes !== undefined ? { designNotes: body.designNotes.trim().slice(0, 1000) || null } : {}),
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

    const designOps: BillingOperation[] = [
      "fashion_design_analysis",
      "fashion_design_analysis",
      "fashion_design_analysis",
      "fashion_design_analysis",
      "fashion_design_gen",
      "fashion_design_gen",
    ];

    const creditResult = await withCreditCheck(
      session.id,
      designOps,
      async () => { await runDesignPipeline(id); }
    );

    if ("insufficientCredits" in creditResult) {
      return NextResponse.json({
        error: "insufficient_credits",
        message: "Not enough credits to regenerate this design. Contact your admin to add more credits.",
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
