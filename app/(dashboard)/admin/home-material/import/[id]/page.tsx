import { notFound } from "next/navigation";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewQueueView } from "./ReviewQueueView";

export const metadata = { title: "Review PDF Import — Internal" };

export default async function HomeMaterialImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) notFound();

  const { id } = await params;
  const [catalogueImport, materials, families] = await Promise.all([
    db.hmCatalogueImport.findUnique({
      where: { id },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    }),
    db.hmMaterial.findMany({ orderBy: { name: "asc" }, select: { id: true, category: true, subtype: true, name: true } }),
    db.hmProductFamily.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!catalogueImport) notFound();

  return (
    <ReviewQueueView
      catalogueImport={JSON.parse(JSON.stringify(catalogueImport))}
      materials={materials}
      families={families}
    />
  );
}
