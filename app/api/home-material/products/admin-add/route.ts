import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateHmUserSession } from "@/lib/home-material/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";
import { recordProductEvidence } from "@/lib/home-material/provenance";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

function parsePositiveFloat(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Internal test-catalogue tool (2026-09-12) — NOT a retailer-onboarding
 * flow (that doesn't exist yet, see docs/home-material/product/overview.md's
 * "Not in V1" list). Lets a developer/tester add a PUBLIC demo product
 * (uploadedByHmUserId: null — same visibility as the seeded demo
 * catalogue, unlike the private "upload your own swatch" flow at
 * products/upload/route.ts) directly from the running app, without
 * editing scripts/seed-home-material.ts, to exercise wallpaper/panel/
 * texture features against real-ish variety. Reachable only via the
 * discreet floating button mounted in app/materials/layout.tsx — never
 * linked from any customer-facing navigation, never shown to a real
 * visitor as a feature.
 */
export async function POST(req: NextRequest) {
  await getOrCreateHmUserSession(); // consistency with every other route only — this endpoint doesn't scope by owner

  const formData = await req.formData();
  const materialId = formData.get("materialId") as string | null;
  const name = (formData.get("name") as string | null)?.trim();

  if (!materialId) {
    return NextResponse.json({ error: "Select a material type" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  const material = await db.hmMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Same mandatory classification as the real upload path (2026-09-09) —
  // a test product needs it too, since it's what lets true-scale tiled
  // rendering work at all for wallpaper/panel sheet goods.
  const patternType = formData.get("patternType") as string | null;
  if (patternType !== "customizable" && patternType !== "repeat_sheet") {
    return NextResponse.json({ error: "Select whether this is a customizable design or a repeating pattern" }, { status: 400 });
  }
  let sheetWidthM: number | null = null;
  let sheetHeightM: number | null = null;
  if (patternType === "repeat_sheet") {
    sheetWidthM = parsePositiveFloat(formData.get("sheetWidthM"));
    sheetHeightM = parsePositiveFloat(formData.get("sheetHeightM"));
    if (sheetWidthM === null || sheetHeightM === null) {
      return NextResponse.json({ error: "A repeating pattern needs its real sheet width and height (in meters)" }, { status: 400 });
    }
  }

  const colorHex = (formData.get("colorHex") as string | null) || null;
  const colorName = (formData.get("colorName") as string | null)?.trim() || null;
  const finish = (formData.get("finish") as string | null)?.trim() || null;
  const patternName = (formData.get("patternName") as string | null)?.trim() || null;
  const priceInr = parsePositiveFloat(formData.get("priceInr"));

  const file = formData.get("file") as File | null;
  let textureAssetUrl: string | null = null;
  let imageUrls = "[]";

  try {
    if (file && file.size > 0) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "File size must be under 5MB" }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      const dataUri = `data:${file.type};base64,${b64}`;
      const result = await uploadWithRetry(dataUri, { folder: "product-match/home-material/test-catalogue" });
      textureAssetUrl = result.secure_url;
      imageUrls = JSON.stringify([result.secure_url]);
    }

    const product = await db.hmProduct.create({
      data: {
        materialId,
        name,
        colorHex,
        colorName,
        finish,
        patternName,
        priceInr,
        priceUnit: priceInr != null ? "per_sqft" : null,
        patternType,
        sheetWidthM,
        sheetHeightM,
        textureAssetUrl,
        imageUrls,
        availability: "in_stock",
        uploadedByHmUserId: null,
      },
    });

    await recordProductEvidence({
      productId: product.id,
      field: "name",
      value: name,
      sourceType: "platform",
      sourceDetail: "Added via the internal test-catalogue tool, not a real retailer listing",
    });

    return NextResponse.json({ product });
  } catch (err) {
    console.error("Home Material test-catalogue add error:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        { error: "Image storage is temporarily unreachable — nothing was saved. Please try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not add test product" }, { status: 500 });
  }
}
