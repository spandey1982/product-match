import { notFound } from "next/navigation";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProductsView } from "./ProductsView";

export const metadata = { title: "Material Catalogue — Internal" };

/**
 * Internal catalogue management — list/add/edit/delete HmProduct rows.
 * Gated by canManageHmCatalogue (full ADMIN or the narrower
 * HM_CATALOGUE_MANAGER role), same 404-for-everyone-else posture as every
 * other /admin/* page.
 */
export default async function HomeMaterialProductsPage() {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) notFound();

  const [products, materials, families] = await Promise.all([
    db.hmProduct.findMany({
      where: { uploadedByHmUserId: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { material: { select: { category: true, subtype: true, name: true } } },
    }),
    db.hmMaterial.findMany({ orderBy: { name: "asc" }, select: { id: true, category: true, subtype: true, name: true } }),
    db.hmProductFamily.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <ProductsView
      initialProducts={JSON.parse(JSON.stringify(products))}
      materials={materials}
      families={families}
    />
  );
}
