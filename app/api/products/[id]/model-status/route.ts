import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Lightweight polling endpoint for model-image generation.
 *
 * Returns the current model image + multi-view gallery for a product so the
 * detail page can show a freshly generated image the moment it lands, without
 * a manual refresh. Generation runs asynchronously after product creation;
 * the client polls this until something appears (or it times out).
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
      select: { url: true, view: true },
    });

    return NextResponse.json({
      modelImageUrl: product.modelImageUrl ?? null,
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
