import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseArray, serializeArray } from "@/lib/serialize";

function mapError(err: unknown): NextResponse | null {
  const msg = (err as Error).message;
  if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET — single collection with hydrated product previews, for the edit dialog.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const collection = await db.shopCollection.findUnique({ where: { id } });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const productIds = parseArray(collection.productIds);
    const products = productIds.length
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true, price: true, imageUrl: true, thumbnailUrl: true, modelImageUrl: true },
        })
      : [];
    // Preserve curation order and silently drop ids for products that no
    // longer exist — same durable-snapshot posture as the public read path.
    const byId = new Map(products.map((p) => [p.id, p]));
    const orderedProducts = productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      },
      products: orderedProducts,
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — rename and/or update the product set.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = (body as { name?: unknown }).name;
    const productIds = (body as { productIds?: unknown }).productIds;

    const data: { name?: string; productIds?: string } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Collection name cannot be empty." }, { status: 400 });
      }
      data.name = name.trim();
    }

    if (productIds !== undefined) {
      if (!Array.isArray(productIds) || productIds.length === 0 || !productIds.every((pid) => typeof pid === "string")) {
        return NextResponse.json({ error: "A collection needs at least one product." }, { status: 400 });
      }
      data.productIds = serializeArray(productIds);
    }

    const collection = await db.shopCollection.update({ where: { id }, data });

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        productCount: parseArray(collection.productIds).length,
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

// DELETE — permanently remove a collection (its public link 404s afterward).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.shopCollection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
