import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";
import { parseProductFormData, requiresImageBeforePublish } from "@/lib/home-material/product-form";
import { deriveColorFamily } from "@/lib/home-material/color-family";
import { serializeArray } from "@/lib/serialize";
import { Prisma } from "@prisma/client";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const product = await db.hmProduct.findUnique({
    where: { id },
    include: { material: { select: { category: true, subtype: true, name: true } }, evidence: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await db.hmProduct.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const parsed = parseProductFormData(formData);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const fields = parsed.data;

  const material = await db.hmMaterial.findUnique({ where: { id: fields.materialId } });
  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const file = formData.get("file") as File | null;
  const willHaveImage = !!(file && file.size > 0) || !!existing.textureAssetUrl;
  const publishError = requiresImageBeforePublish(fields.reviewStatus, willHaveImage);
  if (publishError) {
    return NextResponse.json({ error: publishError }, { status: 400 });
  }

  let textureAssetUrl: string | undefined;
  let imageUrls: string | undefined;

  try {
    if (file && file.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      const dataUri = `data:${file.type};base64,${b64}`;
      const result = await uploadWithRetry(dataUri, { folder: "product-match/home-material/catalogue" });
      textureAssetUrl = result.secure_url;
      imageUrls = serializeArray([result.secure_url]);
    }

    const data: Prisma.HmProductUpdateInput = {
      material: { connect: { id: fields.materialId } },
      name: fields.name,
      sku: fields.sku,
      brand: fields.brand,
      collection: fields.collection,
      description: fields.description,
      colorName: fields.colorName,
      colorHex: fields.colorHex,
      colorFamily: deriveColorFamily(fields.colorHex),
      finish: fields.finish,
      materialComposition: fields.materialComposition,
      patternCategory: fields.patternCategory,
      visualStyle: fields.visualStyle,
      installationMethod: fields.installationMethod,
      sampleAvailable: fields.sampleAvailable,
      patternName: fields.patternName,
      patternRepeatCm: fields.patternRepeatCm,
      orientation: fields.orientation,
      dimensions: fields.dimensions,
      patternType: fields.patternType,
      sheetWidthM: fields.sheetWidthM,
      sheetHeightM: fields.sheetHeightM,
      minWidthM: fields.minWidthM,
      minHeightM: fields.minHeightM,
      priceInr: fields.priceInr,
      priceUnit: fields.priceInr != null ? fields.priceUnit ?? "per_sqft" : null,
      warrantyInfo: fields.warrantyInfo,
      availability: fields.availability,
      reviewStatus: fields.reviewStatus,
      family: fields.familyId ? { connect: { id: fields.familyId } } : { disconnect: true },
      ...(textureAssetUrl !== undefined ? { textureAssetUrl } : {}),
      ...(imageUrls !== undefined ? { imageUrls } : {}),
      lastUpdatedAt: new Date(),
    };

    const product = await db.hmProduct.update({ where: { id }, data });
    return NextResponse.json({ product });
  } catch (err) {
    console.error("[admin/home-material/products/:id] update failed:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        { error: "Image storage is temporarily unreachable — nothing was saved. Please try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not update product" }, { status: 500 });
  }
}

/**
 * Hard-deletes only when nothing references the product (no visualization/
 * recommendation/shortlist/lead/event history). A product with real
 * activity can't be safely removed without losing that history, so this
 * returns 409 and points the admin at unpublishing (reviewStatus: "draft")
 * instead — never a silent partial delete.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  try {
    await db.hmProduct.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (err.code === "P2003") {
        return NextResponse.json(
          { error: "This product has real activity (visualizations, shortlists, leads, etc.) and can't be deleted — set it to draft to remove it from the catalogue instead." },
          { status: 409 }
        );
      }
    }
    console.error("[admin/home-material/products/:id] delete failed:", err);
    return NextResponse.json({ error: "Could not delete product" }, { status: 500 });
  }
}
