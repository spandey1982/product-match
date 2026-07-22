import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toPublicRentalProduct } from "@/lib/rental/public-product";

/**
 * Public, unauthenticated, cross-retailer product listing for the /rent
 * marketplace. Unlike /api/products (scoped to the logged-in retailer), this
 * spans every retailer's active catalog — there is no session here.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const occasion = searchParams.get("occasion");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (category) where.category = category;
    if (occasion) where.occasion = { contains: occasion };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          generatedImages: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          user: { select: { storeName: true } },
        },
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products: products.map((p) => toPublicRentalProduct(p as unknown as Record<string, unknown>)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
