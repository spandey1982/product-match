import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";

/**
 * Material Knowledge — general reference content ("what type of material
 * should I consider?"), deliberately PUBLIC/unauthenticated unlike every
 * other Home Material endpoint. This is curated educational content, not
 * user- or room-specific data, and per the brief's Mode B journey
 * (Room -> Objective -> Requirements -> Material Recommendation -> ...)
 * understanding material types is a step that logically precedes needing
 * an account at all.
 */
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");

  const materials = await db.hmMaterial.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    materials: materials.map((m) => ({
      id: m.id,
      category: m.category,
      subtype: m.subtype,
      name: m.name,
      description: m.description,
      durability: m.durability,
      maintenance: m.maintenance,
      moistureSuitability: m.moistureSuitability,
      installationNotes: m.installationNotes,
      removalNotes: m.removalNotes,
      avgCostPerSqftMinInr: m.avgCostPerSqftMinInr,
      avgCostPerSqftMaxInr: m.avgCostPerSqftMaxInr,
      advantages: parseArray(m.advantages),
      limitations: parseArray(m.limitations),
    })),
  });
}
