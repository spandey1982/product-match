import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPublicShopProduct } from "@/lib/shop/public-product";
import { parseArray } from "@/lib/serialize";

/** Public, unauthenticated, cross-retailer search for /shop — mirrors /api/public/rental-products/search without the isForRent restriction. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const collectionId = searchParams.get("collectionId");

    if (!q.trim()) {
      return NextResponse.json({ products: [] });
    }

    // Admin-curated collection scoping — see /api/public/products.
    let collectionProductIds: string[] | null = null;
    if (collectionId) {
      const collection = await db.shopCollection.findUnique({
        where: { id: collectionId },
        select: { productIds: true },
      });
      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      collectionProductIds = parseArray(collection.productIds);
    }

    const products = await db.product.findMany({
      where: {
        isActive: true,
        user: { showOnShop: true },
        ...(collectionProductIds ? { id: { in: collectionProductIds } } : {}),
        OR: [
          { title: { contains: q } },
          { category: { contains: q } },
          { subcategory: { contains: q } },
          { color: { contains: q } },
          { material: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        generatedImages: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
      },
    });

    return NextResponse.json({
      products: products.map((p) => toPublicShopProduct(p as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
