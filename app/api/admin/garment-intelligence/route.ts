import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { analyzeGarment, GARMENT_INTELLIGENCE_MODEL } from "@/lib/garment-intelligence/analyze";
import { renderPromptNotes } from "@/lib/garment-intelligence/render";

/**
 * Ad-hoc Garment Intelligence analysis (admin R&D tool).
 *
 * POST multipart { file, category } — analyzes an arbitrary uploaded photo
 * WITHOUT creating a product or caching anything: pure "what would the
 * pipeline see for this garment?" inspection. Product-linked (cached)
 * analysis lives at ./[productId]. This is a paid vision call (1–2 requests),
 * triggered deliberately from /admin/garment-intelligence.
 */

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const category = String(form.get("category") || "").trim();

    if (!file) return NextResponse.json({ error: "An image is required." }, { status: 400 });
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Image must be JPEG, PNG or WebP." }, { status: 400 });
    }
    if (!category) return NextResponse.json({ error: "category is required." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const intelligence = await analyzeGarment({
      buffer,
      mime: file.type,
      category,
      storeId: session.id,
      userId: session.id,
    });
    if (!intelligence) {
      return NextResponse.json(
        { error: "Analysis failed — check GEMINI_API_KEY and server logs." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      model: GARMENT_INTELLIGENCE_MODEL,
      promptNotes: renderPromptNotes(intelligence),
      intelligence,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
