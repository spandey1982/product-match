import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { openPdfImportSession, cacheSession } from "@/lib/home-material/pdf-import-sessions";

const MAX_PDF_SIZE = 30 * 1024 * 1024;

/**
 * Bulk PDF catalogue import (2026-09-16, reworked same day after a real
 * supplier PDF exposed a multi-minute blind hang with no feedback). One
 * PDF is expected to be one collection (matches how these arrive from
 * suppliers) — collection/brand are set once for the whole batch, not
 * guessed per page. This endpoint only creates the import record and
 * opens the PDF (fast — just parses structure, decodes nothing yet); the
 * caller then drives per-page extraction itself via repeated calls to
 * POST .../[id]/process-next, so it can show live progress and stop early
 * — see that route and lib/home-material/pdf-import-sessions.ts.
 */
export async function GET() {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const imports = await db.hmCatalogueImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      uploadedByUser: { select: { name: true, email: true } },
      _count: { select: { pages: true } },
    },
  });

  const pendingCounts = await db.hmCatalogueImportPage.groupBy({
    by: ["importId", "reviewStatus"],
    where: { importId: { in: imports.map((i) => i.id) } },
    _count: true,
  });

  const countsByImport = new Map<string, Record<string, number>>();
  for (const row of pendingCounts) {
    const existing = countsByImport.get(row.importId) ?? {};
    existing[row.reviewStatus] = row._count;
    countsByImport.set(row.importId, existing);
  }

  return NextResponse.json({
    imports: imports.map((imp) => ({
      ...imp,
      counts: countsByImport.get(imp.id) ?? {},
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const collection = (formData.get("collection") as string | null)?.trim();
  const brand = (formData.get("brand") as string | null)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!collection) {
    return NextResponse.json({ error: "Collection name is required" }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Choose a PDF to upload" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: "PDF must be under 30MB" }, { status: 400 });
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer());

  let pageCount: number;
  try {
    const pdfSession = await openPdfImportSession(pdfBuffer);
    pageCount = pdfSession.numPages;
    const catalogueImport = await db.hmCatalogueImport.create({
      data: {
        collection,
        brand,
        sourceFileName: file.name,
        uploadedByUserId: session!.id,
        status: "processing",
        pageCount,
      },
    });
    cacheSession(catalogueImport.id, pdfSession);
    return NextResponse.json({ importId: catalogueImport.id, totalPages: pageCount }, { status: 201 });
  } catch (err) {
    console.error("[catalogue-imports] could not open PDF:", err);
    return NextResponse.json(
      { error: "Could not read this PDF — it may be corrupted or password-protected." },
      { status: 400 }
    );
  }
}
