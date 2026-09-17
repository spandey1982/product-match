import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { closeSession } from "@/lib/home-material/pdf-import-sessions";
import { runCollectionInfoExtraction } from "@/lib/home-material/collection-info-runner";

/**
 * Stops an in-progress import early (real user request, 2026-09-16): if
 * the first few pages of a long PDF are clearly misbehaving, or it's just
 * taking longer than the admin wants to wait, they shouldn't have to sit
 * through the rest. Whatever pages were already extracted before this
 * call stay as real, reviewable HmCatalogueImportPage rows — nothing is
 * discarded, only the remaining not-yet-processed pages are skipped.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const catalogueImport = await db.hmCatalogueImport.findUnique({ where: { id } });
  if (!catalogueImport) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (catalogueImport.status === "processing") {
    await db.hmCatalogueImport.update({ where: { id }, data: { status: "cancelled" } });
  }
  await closeSession(id);

  // Fire-and-forget: whatever "info" pages were found before stopping are
  // still worth extracting from, but the admin clicked Stop to get an
  // immediate response, not to wait on one more AI call.
  void runCollectionInfoExtraction(id, session!.id);

  return NextResponse.json({ ok: true });
}
