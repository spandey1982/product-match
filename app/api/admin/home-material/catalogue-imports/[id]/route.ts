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
