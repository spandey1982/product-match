import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateHmUserSession } from "@/lib/home-material/auth";

/**
 * V1 swatch list — curated demo products (scripts/seed-home-material.ts,
 * visible to everyone) plus the signed-in HmUser's own custom uploads
 * (private — never another user's). No retailer filtering yet.
 */
export async function GET() {
  const session = await getOrCreateHmUserSession();

  const products = await db.hmProduct.findMany({
    where: { OR: [{ uploadedByHmUserId: null }, { uploadedByHmUserId: session.id }] },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      colorName: true,
      colorHex: true,
      finish: true,
      patternName: true,
      textureAssetUrl: true,
      uploadedByHmUserId: true,
      patternType: true,
      sheetWidthM: true,
      sheetHeightM: true,
      minWidthM: true,
      minHeightM: true,
      materialId: true,
      material: {
        select: { category: true, avgCostPerSqftMinInr: true, avgCostPerSqftMaxInr: true },
      },
      retailerListings: {
        where: { priceInr: { not: null } },
        orderBy: { priceInr: "asc" },
        take: 1,
        select: { priceInr: true },
      },
    },
  });

  return NextResponse.json({
    products: products.map((p) => {
      const { retailerListings, ...rest } = p;
      const realPrice = retailerListings[0]?.priceInr ?? null;
      return {
        ...rest,
        isCustom: p.uploadedByHmUserId != null,
        // Real, retailer-listed price per sqft when a listing exists;
        // otherwise fall back to the material category's general
        // indicative range (docs/home-material/README.md — same
        // "platform estimate, not a quotation" honesty as everywhere
        // else cost appears). Never both — the UI should show one or
        // the other, not blend them.
        priceInr: realPrice,
        priceIsExact: realPrice != null,
        costRangeMinInr: realPrice == null ? p.material?.avgCostPerSqftMinInr ?? null : null,
        costRangeMaxInr: realPrice == null ? p.material?.avgCostPerSqftMaxInr ?? null : null,
      };
    }),
  });
}
