import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { toPublicShopProduct } from "@/lib/shop/public-product";
import { WishlistView } from "./WishlistView";

export const metadata = { title: "My Wishlist — Shop — Mentis", robots: { index: false, follow: false } };

export default async function WishlistPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/rent/login?returnTo=/shop/wishlist");

  const entries = await db.wishlist.findMany({
    where: { customerId: session.id },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  const productIds = entries.map((e) => e.productId);

  const products = await db.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      generatedImages: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <WishlistView
      initialProducts={ordered.map((p) => toPublicShopProduct(p as unknown as Record<string, unknown>))}
    />
  );
}
