import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { parseProductFormData } from "@/lib/home-material/product-form";
import { createHmProductFromFields } from "@/lib/home-material/create-product";

async function maybeCompleteImport(importId: string) {
  const stillPending = await db.hmCatalogueImportPage.count({ where: { importId, reviewStatus: "pending" } });
  if (stillPending === 0) {
    await db.hmCatalogueImport.update({ where: { id: importId }, data: { status: "completed" } });
  }
}

/**
 * One candidate PDF page, reviewed. "approve" creates a real HmProduct —
 * always landing as a draft (reviewStatus forced to "draft" regardless of
 * what the form submitted), per the two-step review->publish discipline
 * this catalogue tool uses for every entry path, single or bulk. "reject"
 * discards the candidate without creating anything.
 *
 * "approve" is terminal — an already-approved page can't be re-reviewed
 * here; fix the resulting product directly instead (PATCH /api/admin/
 * home-material/products/[id]) to avoid ever double-creating a product
 * for one page. "reject" is NOT terminal (2026-09-17, user-requested): a
 * rejected page can be brought back to "pending" via "restore", since a
 * reject has no side effect to undo (no product was ever created) — see
 * the "restore" branch below.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, pageId } = await params;

  const page = await db.hmCatalogueImportPage.findUnique({ where: { id: pageId } });
  if (!page || page.importId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const action = formData.get("action");

  if (action === "restore") {
    if (page.reviewStatus !== "rejected") {
      return NextResponse.json({ error: `Only a rejected page can be restored (this one is ${page.reviewStatus})` }, { status: 409 });
    }
    const restored = await db.hmCatalogueImportPage.update({
      where: { id: pageId },
      data: { reviewStatus: "pending", reviewedAt: null },
    });
    // Reopening a page means the import has a pending page again, so
    // "completed" (every page left pending) is no longer accurate.
    await db.hmCatalogueImport.updateMany({ where: { id, status: "completed" }, data: { status: "needs_review" } });
    return NextResponse.json({ page: restored });
  }

  if (page.reviewStatus !== "pending") {
    return NextResponse.json({ error: `This page was already ${page.reviewStatus}` }, { status: 409 });
  }

  if (action === "reject") {
    await db.hmCatalogueImportPage.update({
      where: { id: pageId },
      data: { reviewStatus: "rejected", reviewedAt: new Date() },
    });
    await maybeCompleteImport(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const parsed = parseProductFormData(formData);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const fields = parsed.data;

    const material = await db.hmMaterial.findUnique({ where: { id: fields.materialId } });
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const catalogueImport = await db.hmCatalogueImport.findUniqueOrThrow({ where: { id } });

    const product = await createHmProductFromFields(
      {
        ...fields,
        collection: fields.collection ?? catalogueImport.collection,
        brand: fields.brand ?? catalogueImport.brand,
        reviewStatus: "draft", // always — see docstring above
      },
      {
        textureAssetUrl: page.extractedImageUrl,
        evidence: {
          sourceType: "platform",
          sourceDetail: `Bulk-imported from PDF "${catalogueImport.sourceFileName}", page ${page.pageNumber} (import ${catalogueImport.id})`,
        },
      }
    );

    await db.hmCatalogueImportPage.update({
      where: { id: pageId },
      data: { reviewStatus: "approved", reviewedAt: new Date(), resultingProductId: product.id },
    });
    await maybeCompleteImport(id);

    return NextResponse.json({ product });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
