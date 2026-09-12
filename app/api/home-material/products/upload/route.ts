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
 * "Upload your own wallpaper/paint photo" — a real product photo the user
 * already has (e.g. a store sample, a listing screenshot), used directly as
 * a visual reference instead of picking from the curated demo swatches.
 *
 * TEMPORARY, 2026-09-13: normally private to the uploading HmUser (via
 * `uploadedByHmUserId`) — never shown in another user's swatch list. For
 * now, deliberately created as a PUBLIC product (`uploadedByHmUserId:
 * null`, same visibility as the curated demo catalogue) instead, at the
 * user's explicit request: there's no real retailer-onboarding flow yet
 * (see docs/home-material/product/overview.md's "Not in V1" list), and
 * this is the cheapest way to get a small shared catalogue of trial
 * wallpapers/veneers live for anyone using the deployed app to see and
 * try on their own wall — using the existing customer-facing upload
 * flow itself, not a separate admin tool or a direct DB seed. The
 * RoomView.tsx upload panel's copy was updated to disclose this (never
 * silently change a privacy boundary without telling the user).
 *
 * REVERT by restoring `uploadedByHmUserId: session.id` below once a real
 * retailer/admin-onboarding flow exists — see
 * components/home-material/AddTestProductButton.tsx for the discreet,
 * always-public internal tool this doesn't replace.
 */
export async function POST(req: NextRequest) {
  const session = await getOrCreateHmUserSession();

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

  // Mandatory material link (2026-09-13) — without one, the product has
  // no category, so it silently failed to appear anywhere on the
  // /materials browse grid (which only ever renders the 4 known
  // categories) even though it worked fine in this room's own swatch
  // carousel. Also gives a real material-suitability/cost basis instead
  // of none at all.
  const materialId = formData.get("materialId") as string | null;
  if (!materialId) {
    return NextResponse.json({ error: "Select a material type" }, { status: 400 });
  }
  const material = await db.hmMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Mandatory classification (2026-09-09) — every upload must explicitly
  // say whether it's a one-off customizable design or real repeat-pattern
  // sheet goods; a patterned upload must give its real sheet size, since
  // that's what lets the visualization render it at true physical scale
  // instead of stretching it (see lib/home-material/visualization.ts).
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
  const minWidthM = parsePositiveFloat(formData.get("minWidthM"));
  const minHeightM = parsePositiveFloat(formData.get("minHeightM"));

  try {
    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${b64}`;
    const result = await uploadWithRetry(dataUri, { folder: "product-match/home-material/custom-swatches" });

    const product = await db.hmProduct.create({
      data: {
        materialId,
        name: name || "My uploaded material",
        imageUrls: JSON.stringify([result.secure_url]),
        textureAssetUrl: result.secure_url,
        availability: "unspecified",
        // TEMPORARY: null (public), not session.id — see the doc comment above.
        uploadedByHmUserId: null,
        patternType,
        sheetWidthM,
        sheetHeightM,
        minWidthM,
        minHeightM,
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
