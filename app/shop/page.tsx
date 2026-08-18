import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { ShopView } from "./ShopView";

export const metadata = { title: "Shop — Mentis" };

export default async function ShopPage() {
  const session = await getCustomerSession();

  const wishlistedIds = session
    ? (
        await db.wishlist.findMany({
          where: { customerId: session.id },
          select: { productId: true },
        })
      ).map((w) => w.productId)
    : [];

  return <ShopView loggedIn={!!session} wishlistedIds={wishlistedIds} />;
}
