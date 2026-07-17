import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateModelImage } from "@/lib/generate-model-image";
import { db } from "@/lib/db";
import { deserializeProduct } from "@/lib/serialize";
import {
  generateModelImages,
  isAiGenObjectivesEnabled,
} from "@/lib/model-gen/engine";
import { isGenerationObjective } from "@/lib/model-gen/objectives";
import { isModelType } from "@/lib/model-gen/reference-models";
import { isGenerationQuality } from "@/lib/model-gen/quality";
import { isBackdropSection } from "@/lib/model-gen/scenes/selection";
import { categorizeGenerationError, genericFailureMessage } from "@/lib/model-gen/failure-message";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const product = await db.product.findFirst({
      where: { id, userId: session.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Objective-based generation is used whenever the feature flag is on: an
    // explicit objective in the body wins, otherwise the engine resolves the
    // retailer's stored default. This keeps regeneration entry points that
    // send no objective (e.g. the product-page menu) on the SAME pipeline as
    // the upload flow — cached garment intelligence, prompt enrichment, view
    // sets — instead of silently dropping to the legacy single-image flow
    // (observed 2026-07-14: a product-page regeneration ran detail-notes v1
    // and skipped GI entirely). With the flag off, the original single-image
    // flow runs exactly as before.
    const body = await req.json().catch(() => ({}));
    const objective = (body as { objective?: unknown }).objective;
    const modelType = (body as { modelType?: unknown }).modelType;
    const qualityRaw = (body as { quality?: unknown }).quality;
    const quality = isGenerationQuality(qualityRaw) ? qualityRaw : undefined;
    // Studio vs Scenic for THIS run only — a per-generation choice like
    // `quality`, never a sticky default. Absent/invalid → Studio.
    const backdropSectionRaw = (body as { backdropSection?: unknown }).backdropSection;
    const backdropSection = isBackdropSection(backdropSectionRaw) ? backdropSectionRaw : undefined;
    // AI Casting — Signature Model id (optional). Format is validated
    // shallowly here; ownership + soft-delete are checked inside the engine
    // via getModelProfile, so a stale id degrades to auto-pick rather than
    // erroring the request.
    const signatureProfileIdRaw = (body as { signatureProfileId?: unknown }).signatureProfileId;
    const signatureProfileId =
      typeof signatureProfileIdRaw === "string" && signatureProfileIdRaw
        ? signatureProfileIdRaw
        : undefined;

    let failure: "storage_unreachable" | "generation_failed" | undefined;
    if (isAiGenObjectivesEnabled()) {
      const result = await generateModelImages({
        productId: id,
        userId: session.id,
        objective: isGenerationObjective(objective) ? objective : undefined,
        modelType: isModelType(modelType) ? modelType : undefined,
        quality,
        backdropSection,
        signatureProfileId,
      });
      failure = result.failure;
    } else {
      await generateModelImage(id, quality);
    }

    // Use raw query so the cached Prisma client doesn't strip new columns
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM products WHERE id = ${id} LIMIT 1
    `;
    const updated = rows[0] ?? null;
    if (!updated) {
      return NextResponse.json({ error: "Product not found after update" }, { status: 404 });
    }

    // Include the multi-view gallery (empty for legacy / single-image runs).
    const generatedImages = await db.productImage.findMany({
      where: { productId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, url: true, view: true, objective: true, isPrimary: true },
    });

    // Retailer-facing failure messaging: honest about what happened AND what
    // it cost. storage_unreachable is pre-flight (nothing attempted, nothing
    // spent). generation_failed means the run produced no stored images — read
    // the just-recorded error to say WHY (out of credits, network, server…).
    let failureMessage: string | undefined;
    if (failure === "storage_unreachable") {
      failureMessage =
        "Image storage is temporarily unreachable, so generation was not started — no AI usage was spent. Please try again in a few minutes.";
    } else if (failure === "generation_failed") {
      const lastGen = await db.aiUsageEvent.findFirst({
        where: {
          productId: id,
          feature: { in: ["catalogue", "model_gen", "quick_listing"] },
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        select: { status: true, errorMessage: true },
      });
      failureMessage =
        lastGen?.status === "error"
          ? categorizeGenerationError(lastGen.errorMessage).message
          : genericFailureMessage();
    }

    return NextResponse.json({
      product: deserializeProduct(updated),
      generatedImages,
      ...(failure ? { failure, failureMessage } : {}),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
