import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripDeliveryTransforms } from "@/lib/model-gen/crop-templates";
import { CreativeStudioView, type ProductPreview } from "./CreativeStudioView";

export const metadata: Metadata = { title: "Marketing Creative | Marketing Studio" };

// Same objective filter the hero-resolver itself checks first (see
// lib/marketing-creative/hero-resolver.ts) — a read-only preview query for
// the picker UI, not the source of truth for what actually gets rendered.
const GENERATED_OBJECTIVES = ["catalogue", "quick_listing"];

export default async function MarketingCreativePage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { productId } = await searchParams;

  let product: ProductPreview | null = null;
  if (productId) {
    const row = await db.product.findFirst({
      where: { id: productId, userId: session.id },
      select: { id: true, title: true, category: true, price: true, mrpPrice: true, discountPercent: true, imageUrl: true },
    });
    if (row) {
      const photo = await db.productImage.findFirst({
        where: { productId: row.id, view: "front", objective: { in: GENERATED_OBJECTIVES } },
        orderBy: { createdAt: "desc" },
        select: { url: true },
      });
      // Unlike Presenter Reel, this feature works fine with NO generated
      // photo at all — reuse-catalogue/generate-new/product-only degrade
      // gracefully (see hero-resolver.ts) — so the preview just falls back
      // to the raw upload rather than blocking the whole page.
      product = {
        id: row.id,
        title: row.title,
        hasDiscount: Boolean(row.mrpPrice && row.discountPercent),
        previewUrl: photo ? stripDeliveryTransforms(photo.url) : row.imageUrl,
      };
    }
  }

  const pastJobs = product
    ? await db.marketingCreativeJob.findMany({
        where: { productId: product.id, userId: session.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return <CreativeStudioView product={product} initialHistory={JSON.parse(JSON.stringify(pastJobs))} />;
}
