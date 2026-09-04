import { notFound } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";
import { ShopView } from "../../ShopView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const collection = await db.shopCollection.findUnique({ where: { id }, select: { name: true, productIds: true } });
  if (!collection) return { title: "Shop — Mentis" };

  const count = parseArray(collection.productIds).length;
  const description = `${collection.name} — a curated collection of ${count} product${count === 1 ? "" : "s"} on Mentis, with virtual try-on and smart outfit matching.`;

  return {
    title: `${collection.name} — Shop — Mentis`,
    description,
    alternates: { canonical: `/shop/collections/${id}` },
    openGraph: { url: `/shop/collections/${id}`, title: collection.name, description },
  };
}

/**
 * Public, unauthenticated screen for an admin-curated collection (see
 * ShopCollection). Anyone with the link can view it — no auth check here by
 * design. Reuses ShopView wholesale (same filters/search/pagination/wishlist/
 * buy flow as /shop), just scoped via `collectionId`.
 */
export default async function ShopCollectionPage({ params }: Props) {
  const { id } = await params;

  const collection = await db.shopCollection.findUnique({ where: { id }, select: { id: true, name: true, productIds: true } });
  if (!collection) notFound();
  const productCount = parseArray(collection.productIds).length;

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
    <>
      <div className="mb-6 rounded-2xl bg-indigo-50/60 border border-indigo-100 px-4 py-3">
        <p className="text-sm text-indigo-900 leading-relaxed">
          <span className="font-semibold">{collection.name}</span> — a curated collection of{" "}
          {productCount} product{productCount === 1 ? "" : "s"} on Mentis, each with AI virtual
          try-on and smart outfit-matching recommendations.
        </p>
      </div>
      <ShopView
        loggedIn={!!session}
        wishlistedIds={wishlistedIds}
        collectionId={collection.id}
        collectionName={collection.name}
      />
    </>
  );
}
