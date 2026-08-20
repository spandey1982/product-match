import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";
import { ShopCollectionsListView } from "./ShopCollectionsListView";

export const metadata = { title: "Shop Collections — Internal" };

/**
 * Internal-only management screen for admin-curated /shop collections.
 * Admin-gated the same way as app/(dashboard)/admin/review: non-admins get a
 * 404 (no hint it exists), not a 403 redirect.
 */
export default async function ShopCollectionsPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const rows = await db.shopCollection.findMany({ orderBy: { createdAt: "desc" } });
  const collections = rows.map((c) => ({
    id: c.id,
    name: c.name,
    productCount: parseArray(c.productIds).length,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return <ShopCollectionsListView initialCollections={collections} />;
}
