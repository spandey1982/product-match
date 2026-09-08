import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";
import { recordProductEvidence } from "@/lib/home-material/provenance";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * "Upload your own wallpaper/paint photo" — a real product photo the user
 * already has (e.g. a store sample, a listing screenshot), used directly as
 * a visual reference instead of picking from the curated demo swatches.
 * Private to the uploading HmUser (see uploadedByHmUserId on HmProduct) —
 * never shown in another user's swatch list.
 */
export async function POST(req: NextRequest) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File size must be under 5MB" }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${b64}`;
    const result = await uploadWithRetry(dataUri, { folder: "product-match/home-material/custom-swatches" });

    const product = await db.hmProduct.create({
      data: {
        name: name || "My uploaded material",
        imageUrls: JSON.stringify([result.secure_url]),
        textureAssetUrl: result.secure_url,
        availability: "unspecified",
        uploadedByHmUserId: session.id,
      },
    });

    // This one is genuinely user-sourced — they uploaded the actual photo
    // themselves, unlike the curated demo swatches (sourceType "platform")
    // or the retailer's listed prices (sourceType "retailer").
    await recordProductEvidence({
      productId: product.id,
      field: "textureAssetUrl",
      value: result.secure_url,
      sourceType: "user",
      sourceDetail: `Uploaded by HmUser ${session.id}`,
    });

    return NextResponse.json({ product });
  } catch (err) {
    console.error("Home Material custom swatch upload error:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        { error: "Image storage is temporarily unreachable — nothing was saved. Please try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
