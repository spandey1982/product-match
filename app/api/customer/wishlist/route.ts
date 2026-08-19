import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { toPublicShopProduct } from "@/lib/shop/public-product";

// GET — this customer's full wishlist, with product data for the /shop/wishlist grid.
export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in to view your wishlist." }, { status: 401 });
    }

    const entries = await db.wishlist.findMany({
      where: { customerId: session.id },
      orderBy: { createdAt: "desc" },
      select: { productId: true },
    });
    const productIds = entries.map((e) => e.productId);

    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: {
        generatedImages: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
      },
    });
    // Preserve wishlist order (most-recently-added first), not the DB's arbitrary findMany order.
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

    return NextResponse.json({
      products: ordered.map((p) => toPublicShopProduct(p as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — add a product to this customer's wishlist. Idempotent: adding an already-saved product is a no-op, not an error.
export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in to save items." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const productId = (body as { productId?: unknown }).productId;
    if (typeof productId !== "string" || !productId) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    const product = await db.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    await db.wishlist.upsert({
      where: { customerId_productId: { customerId: session.id, productId } },
      create: { customerId: session.id, productId },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
