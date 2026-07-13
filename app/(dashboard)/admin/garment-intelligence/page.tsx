import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { GarmentIntelligenceView, type ProductRow } from "./GarmentIntelligenceView";

export const metadata = { title: "Garment Intelligence — Internal" };

/**
 * R&D inspection UI for the Garment Intelligence pipeline stage (admin-only,
 * not linked in navigation — same convention as /admin/benchmark). Analyze
 * any catalogue product (cached, one analysis per product) or an ad-hoc
 * uploaded photo (uncached), and inspect the structured intelligence + the
 * exact prompt notes generation would receive.
 */
export default async function GarmentIntelligencePage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      category: true,
      color: true,
      imageUrl: true,
      thumbnailUrl: true,
      garmentIntelligence: { select: { updatedAt: true, model: true } },
    },
  });

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    color: p.color,
    imageUrl: p.thumbnailUrl ?? p.imageUrl,
    analyzedAt: p.garmentIntelligence?.updatedAt?.toISOString() ?? null,
    analyzedModel: p.garmentIntelligence?.model ?? null,
  }));

  return <GarmentIntelligenceView products={rows} />;
}
