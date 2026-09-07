import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/** V1 swatch list — seeded example products (scripts/seed-home-material.ts), no retailer filtering yet. */
export async function GET() {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await db.hmProduct.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      colorName: true,
      colorHex: true,
      finish: true,
      patternName: true,
      material: { select: { category: true } },
    },
  });

  return NextResponse.json({ products });
}
