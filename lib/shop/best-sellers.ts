import { db } from "@/lib/db";
import { toPublicShopProduct, type PublicShopProduct } from "@/lib/shop/public-product";

export type BestSeller = PublicShopProduct & { orderCount: number };

// The only statuses that represent a genuinely completed transaction — see
// prisma/schema.prisma's ShopOrder doc comment for the full status list.
// Excludes "requested"/"confirmed"/"shipped"/etc so an order still in
// flight (or cancelled/denied) never counts as a popularity signal.
const COMPLETED_STATUSES = ["delivered", "order_completed"];

/**
 * Real popularity, not a fabricated "trending" label — counts actual
 * completed ShopOrder rows per product, marketplace-wide. ShopOrder.productId
 * is a plain string (no FK — see its schema comment), so completed products
 * that were later deactivated/deleted are naturally excluded by the isActive
 * join below rather than needing a separate check.
 */
export async function getBestSellers(limit = 8): Promise<BestSeller[]> {
  const grouped = await db.shopOrder.groupBy({
    by: ["productId"],
    where: { status: { in: COMPLETED_STATUSES } },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit * 3, // buffer — some winners may since have gone inactive/out of stock
  });

  if (grouped.length === 0) return [];

  const orderCountByProductId = new Map(grouped.map((g) => [g.productId, g._count._all]));

  const products = await db.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) }, isActive: true, inStock: true },
    include: {
      generatedImages: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
    },
  });

  return products
    .map((p) => ({
      ...toPublicShopProduct(p as unknown as Record<string, unknown>),
      orderCount: orderCountByProductId.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}
