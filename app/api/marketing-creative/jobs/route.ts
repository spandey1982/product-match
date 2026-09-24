import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMarketingCreativeJob } from "@/lib/marketing-creative/orchestrator";
import { isCanvasKey } from "@/lib/marketing-creative/canvas";
import type { CanvasKey, ContentMode, CreativeObjective, PlatformHint, RequestedHeroSourceMode, TemplateFamily } from "@/lib/marketing-creative/types";

const OBJECTIVES: readonly CreativeObjective[] = ["discovery", "price_promotion", "seasonal_occasion"];
const CONTENT_MODES: readonly ContentMode[] = ["aspirational", "price-led"];
const HERO_SOURCE_MODES: readonly RequestedHeroSourceMode[] = ["auto", "reuse-catalogue", "generate-new", "product-only"];
const PLATFORMS: readonly PlatformHint[] = ["instagram-feed", "instagram-story", "website-banner", "pinterest"];
const TEMPLATE_FAMILIES: readonly TemplateFamily[] = ["promo-benefits", "hero-editorial", "styled-promo"];

// GET /api/marketing-creative/jobs?productId=... — history list for the
// studio's "Previous generations" panel. Scoped to both productId and the
// caller's own userId, same shape as /api/presenter-reel/jobs.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const productId = req.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const jobs = await db.marketingCreativeJob.findMany({
      where: { productId, userId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/marketing-creative/jobs — create AND, for reuse-catalogue /
// product-only hero-source-modes, fully render a marketing creative job in
// one call (those two modes are deterministic and fast — no queue). Only
// generate-new goes through pg-boss; see orchestrator.ts's header for why.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = (await req.json().catch(() => null)) as
      | {
          productId?: string;
          aspectRatios?: string[];
          objective?: string;
          templateFamily?: string;
          contentMode?: string;
          heroSourceMode?: string;
          platform?: string;
        }
      | null;

    if (!body?.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!body.objective || !OBJECTIVES.includes(body.objective as CreativeObjective)) {
      return NextResponse.json({ error: `objective must be one of: ${OBJECTIVES.join(", ")}` }, { status: 400 });
    }
    const aspectRatios = Array.isArray(body.aspectRatios)
      ? (body.aspectRatios.filter((a): a is CanvasKey => typeof a === "string" && isCanvasKey(a)) as CanvasKey[])
      : [];
    if (aspectRatios.length === 0) {
      return NextResponse.json({ error: "aspectRatios must include at least one valid canvas" }, { status: 400 });
    }
    if (body.templateFamily && !TEMPLATE_FAMILIES.includes(body.templateFamily as TemplateFamily)) {
      return NextResponse.json({ error: `templateFamily must be one of: ${TEMPLATE_FAMILIES.join(", ")}` }, { status: 400 });
    }
    if (body.contentMode && !CONTENT_MODES.includes(body.contentMode as ContentMode)) {
      return NextResponse.json({ error: `contentMode must be one of: ${CONTENT_MODES.join(", ")}` }, { status: 400 });
    }
    if (body.heroSourceMode && !HERO_SOURCE_MODES.includes(body.heroSourceMode as RequestedHeroSourceMode)) {
      return NextResponse.json({ error: `heroSourceMode must be one of: ${HERO_SOURCE_MODES.join(", ")}` }, { status: 400 });
    }
    if (body.platform && !PLATFORMS.includes(body.platform as PlatformHint)) {
      return NextResponse.json({ error: `platform must be one of: ${PLATFORMS.join(", ")}` }, { status: 400 });
    }

    const created = await createMarketingCreativeJob({
      productId: body.productId,
      userId: session.id,
      aspectRatios,
      objective: body.objective as CreativeObjective,
      templateFamily: body.templateFamily as TemplateFamily | undefined,
      contentMode: body.contentMode as ContentMode | undefined,
      heroSourceMode: body.heroSourceMode as RequestedHeroSourceMode | undefined,
      platform: body.platform as PlatformHint | undefined,
    });

    // Re-fetch the full row — for reuse-catalogue/product-only this already
    // carries status "complete" with populated outputs; for generate-new
    // it's "queued", and the client starts polling GET /jobs/[id].
    const job = await db.marketingCreativeJob.findUnique({ where: { id: created.id } });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: (err as Error).message || "Internal server error" }, { status: 500 });
  }
}
