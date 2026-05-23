import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { deserializeProduct } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!q.trim()) {
      return NextResponse.json({ products: [] });
    }

    const products = await db.product.findMany({
      where: {
        userId: session.id,
        isActive: true,
        OR: [
          { title: { contains: q } },
          { category: { contains: q } },
          { subcategory: { contains: q } },
          { color: { contains: q } },
          { material: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      products: products.map((p) =>
        deserializeProduct(p as unknown as Record<string, unknown>)
      ),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
