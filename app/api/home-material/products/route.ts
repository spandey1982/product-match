import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * V1 swatch list — curated demo products (scripts/seed-home-material.ts,
 * visible to everyone) plus the signed-in HmUser's own custom uploads
 * (private — never another user's). No retailer filtering yet.
 */
export async function GET() {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      material: { select: { category: true } },
    },
  });

  return NextResponse.json({
    products: products.map((p) => ({ ...p, isCustom: p.uploadedByHmUserId != null })),
  });
}
