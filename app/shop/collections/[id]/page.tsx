import { notFound } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { ShopView } from "../../ShopView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const collection = await db.shopCollection.findUnique({ where: { id }, select: { name: true } });
  return { title: collection ? `${collection.name} — Shop — Mentis` : "Shop — Mentis" };
}

/**
 * Public, unauthenticated screen for an admin-curated collection (see
 * ShopCollection). Anyone with the link can view it — no auth check here by
 * design. Reuses ShopView wholesale (same filters/search/pagination/wishlist/
 * buy flow as /shop), just scoped via `collectionId`.
 */
export default async function ShopCollectionPage({ params }: Props) {
  const { id } = await params;

  const collection = await db.shopCollection.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!collection) notFound();

  const session = await getCustomerSession();
  const wishlistedIds = session
    ? (
        await db.wishlist.findMany({
          where: { customerId: session.id },
          select: { productId: true },
        })
      ).map((w) => w.productId)
    : [];

  return (
    <ShopView
      loggedIn={!!session}
      wishlistedIds={wishlistedIds}
      collectionId={collection.id}
      collectionName={collection.name}
    />
  );
}
