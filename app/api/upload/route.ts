import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF are allowed" },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be under 5MB" },
        { status: 400 }
      );
    }

    // Convert to base64 data URI for Cloudinary upload
    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${b64}`;

    // Retried upload; connectivity failures get an honest, actionable message
    // (the Add Product form shows server errors verbatim) instead of a
    // generic 500 — observed 2026-07-14: a DNS flap to api.cloudinary.com
    // failed the upload and blocked the whole add-to-catalogue flow.
    const result = await uploadWithRetry(dataUri, { folder: "product-match/products" });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Upload error:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        {
          error:
            "Image storage is temporarily unreachable — nothing was saved. Please try again in a few minutes; your product details are still on this page.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
