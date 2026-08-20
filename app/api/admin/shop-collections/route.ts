import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseArray, serializeArray } from "@/lib/serialize";

/**
 * Admin-only CRUD for /shop collections (internal curation tool — see
 * ShopCollection in prisma/schema.prisma). Not exposed to retailers/customers.
 */

function mapError(err: unknown): NextResponse | null {
  const msg = (err as Error).message;
  if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET — list all collections for the management screen.
export async function GET() {
  try {
    await requireAdmin();

    const rows = await db.shopCollection.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      collections: rows.map((c) => ({
        id: c.id,
        name: c.name,
        productCount: parseArray(c.productIds).length,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create a collection from a set of product ids. The returned `id`
// (cuid, DB-generated) is the public link — /shop/collections/{id}.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const name = (body as { name?: unknown }).name;
    const productIds = (body as { productIds?: unknown }).productIds;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Collection name is required." }, { status: 400 });
    }
    if (!Array.isArray(productIds) || productIds.length === 0 || !productIds.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "Select at least one product." }, { status: 400 });
    }

    const collection = await db.shopCollection.create({
      data: {
        name: name.trim(),
        productIds: serializeArray(productIds),
        createdBy: session.id,
      },
    });

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        productCount: productIds.length,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
