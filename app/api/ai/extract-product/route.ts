import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { analyzeProductImage } from "@/lib/metadata/analyze";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF are supported" },
        { status: 400 }
      );
    }

    // Delegate to the shared, provider-agnostic metadata service.
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await analyzeProductImage(buffer, file.type, {
      storeId: session.id,
      userId: session.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ product: result.metadata });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("extract-product error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
