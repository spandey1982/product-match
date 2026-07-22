import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPublicRentalProduct } from "@/lib/rental/public-product";

/** Public, unauthenticated, cross-retailer search — mirrors /api/products/search without the session scope. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!q.trim()) {
      return NextResponse.json({ products: [] });
    }

    const products = await db.product.findMany({
      where: {
        isActive: true,
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
        user: { select: { storeName: true } },
      },
    });

    return NextResponse.json({
      products: products.map((p) => toPublicRentalProduct(p as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
