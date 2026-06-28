import { db } from "@/lib/db";
import { serializeArray } from "@/lib/serialize";
import { generateRecommendations } from "@/lib/matching-engine/scorer";
import type { CatalogResult } from "../types";

/**
 * Publishing Agent — creates a Product record from catalog results and links
 * it back to the AutoCatalogItem. The product lands in the regular catalog.
 */
export async function publishingAgent(
  itemId: string,
  imageUrl: string,
  catalogResult: CatalogResult,
  userId: string
): Promise<string> {
  const title = String(catalogResult.title.value);
  const category = String(catalogResult.category.value);
  const color = String(catalogResult.color.value);
  const price = Number(catalogResult.price.value) || 0;

  const product = await db.product.create({
    data: {
      title,
      description: String(catalogResult.description.value),
      category,
      subcategory: String(catalogResult.subcategory.value) || null,
      color,
      colors: serializeArray([color]),
      occasion: serializeArray(
        Array.isArray(catalogResult.occasion.value) ? catalogResult.occasion.value as string[] : []
      ),
      styleTags: serializeArray(
        Array.isArray(catalogResult.styleTags.value) ? catalogResult.styleTags.value as string[] : []
      ),
      material: String(catalogResult.material.value) || null,
      pattern: String(catalogResult.pattern.value) || null,
      gender: String(catalogResult.gender.value) || "WOMEN",
      season: serializeArray(
        Array.isArray(catalogResult.season.value) ? catalogResult.season.value as string[] : []
      ),
      price,
      imageUrl,
      userId,
    },
  });

  // Link item to the created product
  await db.autoCatalogItem.update({
    where: { id: itemId },
    data: { productId: product.id, stage: "published" },
  });

  // Fire-and-forget recommendations
  const peers = await db.product.findMany({
    where: { userId, isActive: true, id: { not: product.id } },
    select: { id: true },
  });
  Promise.allSettled(
    peers.map((p) => generateRecommendations(p.id, userId))
  ).catch(console.error);

  return product.id;
}
