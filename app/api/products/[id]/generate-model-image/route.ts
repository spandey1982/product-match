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

    // Objective-based generation is opt-in via the feature flag AND an explicit
    // objective in the body. Without both, we run the original single-image flow
    // so existing callers (and the legacy upload toggle) behave exactly as before.
    const body = await req.json().catch(() => ({}));
    const objective = (body as { objective?: unknown }).objective;
    const modelType = (body as { modelType?: unknown }).modelType;

    if (isAiGenObjectivesEnabled() && isGenerationObjective(objective)) {
      await generateModelImages({
        productId: id,
        userId: session.id,
        objective,
        modelType: isModelType(modelType) ? modelType : undefined,
      });
    } else {
      await generateModelImage(id);
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

    return NextResponse.json({
      product: deserializeProduct(updated),
      generatedImages,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
