import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureGarmentIntelligence } from "@/lib/garment-intelligence/service";

/**
 * R&D inspection endpoint for Garment Intelligence (admin-only, not linked in
 * navigation). Lets the structured analysis be examined directly — without
 * running a full (paid) image generation.
 *
 *   GET  — return the cached intelligence row. Never triggers an AI call.
 *   POST — run (or re-run, if the image changed) the analysis for a product.
 *          This IS a paid vision call; it exists so R&D can trigger extraction
 *          deliberately and inspect the result.
 */

function mapError(err: unknown): NextResponse | null {
  const msg = (err as Error).message;
  if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    await requireAdmin();
    const { productId } = await params;

    const row = await db.garmentIntelligence.findUnique({ where: { productId } });
    if (!row) {
      return NextResponse.json(
        { error: "No garment intelligence cached for this product. POST to analyze." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      productId,
      model: row.model,
      version: row.version,
      analyzedImageUrl: row.analyzedImageUrl,
      promptNotes: row.promptNotes,
      intelligence: JSON.parse(row.data),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { productId } = await params;

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, imageUrl: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (!product.imageUrl) {
      return NextResponse.json({ error: "Product has no image to analyze." }, { status: 400 });
    }

    const record = await ensureGarmentIntelligence(productId, {
      storeId: session.id,
      userId: session.id,
    });
    if (!record) {
      return NextResponse.json(
        { error: "Analysis failed — check GEMINI_API_KEY and server logs." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      productId,
      model: record.model,
      analyzedImageUrl: record.analyzedImageUrl,
      promptNotes: record.promptNotes,
      intelligence: record.intelligence,
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
