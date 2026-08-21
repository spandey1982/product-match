import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPublicShopProduct } from "@/lib/shop/public-product";

/** Public, unauthenticated single-product lookup for the /shop detail page. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const raw = await db.product.findFirst({
      where: { id, isActive: true, user: { showOnShop: true } },
      include: {
        generatedImages: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
      },
    });

    if (!raw) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      product: toPublicShopProduct(raw as unknown as Record<string, unknown>),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
