import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated collection metadata — powers the /shop/collections/{id}
 * page header. Product listing itself goes through /api/public/products?collectionId=,
 * which reuses the full existing filter/search/pagination pipeline.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const collection = await db.shopCollection.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json({ collection });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
