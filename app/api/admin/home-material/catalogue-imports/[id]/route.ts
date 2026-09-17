import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const catalogueImport = await db.hmCatalogueImport.findUnique({
    where: { id },
    include: {
      uploadedByUser: { select: { name: true, email: true } },
      pages: { orderBy: { pageNumber: "asc" } },
    },
  });
  if (!catalogueImport) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ import: catalogueImport });
}

/**
 * Bulk-clears the "Already reviewed" list (2026-09-17, user-requested) —
 * permanently deletes every non-pending HmCatalogueImportPage row for
 * this import. Deliberately never touches pending pages (nothing to
 * "clear" there — they still need a decision) or the resulting HmProduct
 * of an approved page (the FK points from the page to the product, not
 * the other way around, so deleting the page row is pure bookkeeping
 * cleanup, not a product deletion). This is the "final deletion" a
 * rejected page's restore option (PATCH .../pages/[pageId]) stops being
 * possible after.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const result = await db.hmCatalogueImportPage.deleteMany({
    where: { importId: id, reviewStatus: { not: "pending" } },
  });
  return NextResponse.json({ deleted: result.count });
}
