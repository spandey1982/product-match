import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { previewPresenterScript } from "@/lib/presenter-reel/orchestrator";

// POST /api/presenter-reel/script-preview — generates a script for the
// Studio UI's review/edit step WITHOUT creating a job or enqueuing a render.
// No Veo cost — a single Gemini text call, same as every other in-app
// script/copy generation. The retailer edits the returned script client-side
// before POSTing the real (billed) job to /api/presenter-reel/jobs.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = (await req.json().catch(() => null)) as
      | {
          productId?: string;
          durationSec?: number;
          deliveryMode?: "full_script" | "hook_end_card";
          ctaMode?: "none" | "on_screen" | "spoken";
          ctaText?: string;
          timingMode?: "smart" | "fixed";
        }
      | null;

    if (!body?.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const preview = await previewPresenterScript({
      productId: body.productId,
      userId: session.id,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
      deliveryMode: body.deliveryMode,
      ctaMode: body.ctaMode,
      ctaText: body.ctaText,
      timingMode: body.timingMode,
    });

    return NextResponse.json(preview);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: (err as Error).message || "Internal server error" }, { status: 500 });
  }
}
