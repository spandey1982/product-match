import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { closeSession, getActiveSession } from "@/lib/home-material/pdf-import-sessions";
import { processImportPage } from "@/lib/home-material/process-import-page";
import { runCollectionInfoExtraction } from "@/lib/home-material/collection-info-runner";

/**
 * Processes exactly ONE page of an in-progress PDF import and reports
 * where things stand — the caller (ImportView.tsx) calls this in a loop to
 * drive extraction and show live "page X of Y" progress instead of a
 * single blind multi-minute request. Idempotent-ish per call: always
 * processes `pagesProcessed + 1`, so a client retry after a network blip
 * just repeats the same next page rather than skipping or double-
 * processing (a page is only ever created once, matching pagesProcessed).
 *
 * Relies entirely on the in-memory session cache (see
 * pdf-import-sessions.ts's doc comment for why the raw PDF isn't
 * persisted) — if it's missing (server restarted mid-import, or the
 * import sat idle past the eviction window), this fails with a clear
 * "re-upload" error rather than silently reprocessing from scratch. Pages
 * already extracted before that point remain valid, reviewable rows.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const catalogueImport = await db.hmCatalogueImport.findUnique({ where: { id } });
  if (!catalogueImport) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (catalogueImport.status !== "processing") {
    return NextResponse.json({
      done: true,
      status: catalogueImport.status,
      pagesProcessed: catalogueImport.pagesProcessed,
      totalPages: catalogueImport.pageCount,
    });
  }

  const pdfSession = getActiveSession(id);
  if (!pdfSession) {
    const message =
      "This import's processing session is no longer available (the server may have restarted). " +
      "The pages already found are still saved — re-upload the same PDF to pick up the rest.";
    await db.hmCatalogueImport.update({ where: { id }, data: { status: "failed", errorMessage: message } });
    return NextResponse.json({ error: message }, { status: 410 });
  }

  try {
    const nextPage = catalogueImport.pagesProcessed + 1;
    const { candidateCount } = await processImportPage(id, pdfSession, nextPage, catalogueImport.brand, session!.id);

    const pagesProcessed = nextPage;
    const isDone = pagesProcessed >= catalogueImport.pageCount;

    const updated = await db.hmCatalogueImport.update({
      where: { id },
      data: {
        pagesProcessed,
        ...(isDone ? { status: "needs_review" } : {}),
      },
    });

    if (isDone) {
      await closeSession(id);
      await runCollectionInfoExtraction(id, session!.id);
    }

    return NextResponse.json({
      done: isDone,
      status: updated.status,
      pagesProcessed: updated.pagesProcessed,
      totalPages: updated.pageCount,
      candidatesFoundOnPage: candidateCount,
    });
  } catch (err) {
    console.error(`[catalogue-imports] process-next failed for import ${id}:`, err);
    await db.hmCatalogueImport.update({
      where: { id },
      data: { status: "failed", errorMessage: "Extraction failed partway through — see server logs." },
    });
    await closeSession(id);
    return NextResponse.json({ error: "Extraction failed on this page. The pages already found are still saved." }, { status: 500 });
  }
}
