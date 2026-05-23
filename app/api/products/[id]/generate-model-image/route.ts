import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateModelImage } from "@/lib/generate-model-image";
import { db } from "@/lib/db";
import { deserializeProduct } from "@/lib/serialize";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const product = await db.product.findFirst({
      where: { id, userId: session.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await generateModelImage(id);

    // Use raw query so the cached Prisma client doesn't strip new columns
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM products WHERE id = ${id} LIMIT 1
    `;
    const updated = rows[0] ?? null;
    if (!updated) {
      return NextResponse.json({ error: "Product not found after update" }, { status: 404 });
    }
    return NextResponse.json({
      product: deserializeProduct(updated),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
