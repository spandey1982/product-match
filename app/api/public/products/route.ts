import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toPublicShopProduct } from "@/lib/shop/public-product";
import { findCityCoordinate } from "@/lib/geo/city-coordinates";
import { haversineKm, type Coordinate } from "@/lib/geo/distance";

/** lat/lng (precise, browser geolocation) takes priority over a city name (coarse fallback) — see ShopView. */
function resolveShopperCoordinate(searchParams: URLSearchParams): Coordinate | null {
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const cityCoord = findCityCoordinate(searchParams.get("city"));
  return cityCoord ? { lat: cityCoord.lat, lng: cityCoord.lng } : null;
}

/**
 * Public, unauthenticated, cross-retailer product listing for /shop. Spans
 * every active product regardless of isForRent (unlike
 * /api/public/rental-products, which only lists rental-enabled ones) — /shop
 * covers both buying and renting. Distance-to-shopper is computed per row
 * when a location is supplied, but NOT filtered/sorted at the query level
 * (there's no lat/lng column) — the client partitions a fetched page into
 * "within radius" / "beyond radius" the same way CatalogView already does
 * for its price-window filter, so radius shares that feature's known
 * page-boundary quirk rather than inventing a new one.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const occasion = searchParams.get("occasion");
    const subcategory = searchParams.get("subcategory");
    const color = searchParams.get("color");
    const gender = searchParams.get("gender");
    const priceMin = parseInt(searchParams.get("priceMin") || "0");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (category) where.category = category;
    if (occasion) where.occasion = { contains: occasion };
    if (subcategory) where.subcategory = subcategory;
    if (color) where.color = color;
    if (gender) where.gender = gender;
    if (priceMin > 0) where.price = { gte: priceMin };

    const subcategoryWhere: Prisma.ProductWhereInput = {
      isActive: true,
      subcategory: { not: null },
      ...(category ? { category } : {}),
    };

    const shopperCoord = resolveShopperCoordinate(searchParams);

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
          user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
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
      products: products.map((p) => {
        const storeCoord = findCityCoordinate((p as unknown as { user?: { storeCity?: string | null } }).user?.storeCity);
        const distanceKm = shopperCoord && storeCoord ? haversineKm(shopperCoord, storeCoord) : null;
        return toPublicShopProduct(p as unknown as Record<string, unknown>, distanceKm);
      }),
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
