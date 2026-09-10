import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * Shortlist + Compare (brief §16 core journey: Visualize -> Understand ->
 * Compare -> Shortlist -> Estimate -> ...). HmShortlistItem is
 * product-level (a specific swatch/SKU the user is actually considering),
 * not material-level like HmRecommendation — you shortlist candidates,
 * you don't shortlist a whole category.
 */

function resolveCost(product: {
  material: { avgCostPerSqftMinInr: number | null; avgCostPerSqftMaxInr: number | null } | null;
  retailerListings: { priceInr: number | null }[];
}) {
  const realPrice = product.retailerListings[0]?.priceInr ?? null;
  return {
    priceInr: realPrice,
    priceIsExact: realPrice != null,
    costRangeMinInr: realPrice == null ? product.material?.avgCostPerSqftMinInr ?? null : null,
    costRangeMaxInr: realPrice == null ? product.material?.avgCostPerSqftMaxInr ?? null : null,
  };
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  colorName: true,
  colorHex: true,
  finish: true,
  patternName: true,
  textureAssetUrl: true,
  material: {
    select: {
      name: true,
      category: true,
      subtype: true,
      durability: true,
      maintenance: true,
      moistureSuitability: true,
      avgCostPerSqftMinInr: true,
      avgCostPerSqftMaxInr: true,
    },
  },
  retailerListings: {
    where: { priceInr: { not: null as number | null } },
    orderBy: { priceInr: "asc" as const },
    take: 1,
    select: { priceInr: true },
  },
} as const;

export async function GET() {
  const session = await getHmUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.hmShortlistItem.findMany({
    where: { hmUserId: session.id },
    orderBy: { createdAt: "asc" },
    include: { product: { select: PRODUCT_SELECT } },
  });

  return NextResponse.json({
    items: items.map((item) => {
      const { retailerListings, ...product } = item.product;
      void retailerListings;
      return {
        id: item.id,
        note: item.note,
        createdAt: item.createdAt,
        product: { ...product, ...resolveCost(item.product) },
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const session = await getHmUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, note } = await req.json();
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const product = await db.hmProduct.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const item = await db.hmShortlistItem.upsert({
    where: { hmUserId_productId: { hmUserId: session.id, productId } },
    update: { note: typeof note === "string" ? note.trim() || null : undefined },
    create: { hmUserId: session.id, productId, note: typeof note === "string" && note.trim() ? note.trim() : null },
  });

  return NextResponse.json({ item });
}
