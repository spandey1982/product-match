import { db } from "@/lib/db";
import { generateModelImages, isAiGenObjectivesEnabled } from "@/lib/model-gen/engine";
import { generateModelImage } from "@/lib/generate-model-image";

/**
 * Image Agent — triggers model image generation for a product that has already
 * been created in the database. Reuses the existing generation engine.
 */
export async function imageAgent(
  productId: string,
  userId: string
): Promise<{ imageUrls: string[] }> {
  if (isAiGenObjectivesEnabled()) {
    const result = await generateModelImages({
      productId,
      userId,
      objective: "catalogue",
    });
    return { imageUrls: result.images.map((i) => i.url) };
  }

  // Legacy single-image flow
  await generateModelImage(productId);

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { modelImageUrl: true },
  });

  return { imageUrls: product?.modelImageUrl ? [product.modelImageUrl] : [] };
}
