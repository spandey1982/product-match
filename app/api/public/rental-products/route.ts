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
    const subcategory = searchParams.get("subcategory");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");

    const where: Prisma.ProductWhereInput = { isActive: true, isForRent: true };
    if (category) where.category = category;
    if (occasion) where.occasion = { contains: occasion };
    if (subcategory) where.subcategory = subcategory;

    // Subcategory is free text (no fixed taxonomy), so the filter's own
    // options come from what retailers have actually entered — scoped to the
    // selected category, since a subcategory is only meaningful within one
    // (e.g. "Bridal Saree" shouldn't appear as an option under Lehenga).
    const subcategoryWhere: Prisma.ProductWhereInput = {
      isActive: true,
      isForRent: true,
      subcategory: { not: null },
      ...(category ? { category } : {}),
    };

    const [products, total, subcategoryRows] = await Promise.all([
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
      db.product.findMany({
        where: subcategoryWhere,
        select: { subcategory: true },
        distinct: ["subcategory"],
      }),
    ]);

    const subcategories = subcategoryRows
      .map((r) => r.subcategory)
      .filter((s): s is string => !!s && s.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      products: products.map((p) => toPublicRentalProduct(p as unknown as Record<string, unknown>)),
      subcategories,
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
