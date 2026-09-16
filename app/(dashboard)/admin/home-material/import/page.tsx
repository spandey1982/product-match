import { notFound } from "next/navigation";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { db } from "@/lib/db";
import { ImportView } from "./ImportView";

export const metadata = { title: "Catalogue PDF Import — Internal" };

export default async function HomeMaterialImportPage() {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) notFound();

  const imports = await db.hmCatalogueImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedByUser: { select: { name: true, email: true } } },
  });

  const pageCounts = await db.hmCatalogueImportPage.groupBy({
    by: ["importId", "reviewStatus"],
    where: { importId: { in: imports.map((i) => i.id) } },
    _count: true,
  });
  const countsByImport: Record<string, Record<string, number>> = {};
  for (const row of pageCounts) {
    (countsByImport[row.importId] ??= {})[row.reviewStatus] = row._count;
  }

  return (
    <ImportView
      initialImports={imports.map((imp) => ({
        ...JSON.parse(JSON.stringify(imp)),
        counts: countsByImport[imp.id] ?? {},
      }))}
    />
  );
}
