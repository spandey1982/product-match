import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categorizeGenerationError } from "@/lib/model-gen/failure-message";

/** Generation features whose failures mean "no model image is coming". */
const GEN_FEATURES = ["catalogue", "model_gen", "quick_listing"];

/**
 * Lightweight polling endpoint for model-image generation.
 *
 * Returns the current model image + multi-view gallery for a product so the
 * detail page can show a freshly generated image the moment it lands, without
 * a manual refresh. Generation runs asynchronously after product creation;
 * the client polls this until something appears — OR until this endpoint
 * reports a `failed` state, so the client stops spinning and shows a specific
 * reason (out of credits, network, storage, server, unknown) instead of
 * hanging until the poll's own timeout.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const product = await db.product.findFirst({
      where: { id, userId: session.id },
      select: { modelImageUrl: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const generatedImages = await db.productImage.findMany({
      where: { productId: id },
      orderBy: { createdAt: "asc" },
      select: { url: true, view: true, objective: true },
    });

    const hasOnModel =
      Boolean(product.modelImageUrl) ||
      generatedImages.some((g) => g.objective === "model" || g.view === "on-model");

    // Failure detection: only when NO on-model image exists yet. If the most
    // recent generation AI call for this product (last 10 min) errored, the run
    // is done and failed — surface a specific reason so the poll can stop.
    let failed = false;
    let failureReason: string | null = null;
    let failureMessage: string | null = null;
    if (!hasOnModel) {
      const lastGen = await db.aiUsageEvent.findFirst({
        where: {
          productId: id,
          feature: { in: GEN_FEATURES },
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        select: { status: true, errorMessage: true },
      });
      if (lastGen?.status === "error") {
        const cat = categorizeGenerationError(lastGen.errorMessage);
        failed = true;
        failureReason = cat.reason;
        failureMessage = cat.message;
      }
    }

    return NextResponse.json({
      modelImageUrl: product.modelImageUrl ?? null,
      generatedImages,
      failed,
      failureReason,
      failureMessage,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
