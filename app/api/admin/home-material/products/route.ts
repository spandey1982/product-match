import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageHmCatalogue } from "@/lib/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";
import { parseProductFormData, requiresImageBeforePublish } from "@/lib/home-material/product-form";
import { createHmProductFromFields } from "@/lib/home-material/create-product";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Internal catalogue admin: list + create HmProduct rows. Replaces the old
 * discreet "test-catalogue" tool (see docs/home-material/architecture/
 * system.md) with a real form covering the full product shape. Gated by
 * canManageHmCatalogue — a full ADMIN or the narrower HM_CATALOGUE_MANAGER
 * role, never a plain retailer session.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const reviewStatus = searchParams.get("reviewStatus");
  const materialId = searchParams.get("materialId");

  const products = await db.hmProduct.findMany({
    where: {
      uploadedByHmUserId: null, // curated catalogue only — never a customer's private upload
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(materialId ? { materialId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { collection: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { material: { select: { category: true, subtype: true, name: true } } },
  });

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!canManageHmCatalogue(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const parsed = parseProductFormData(formData);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const fields = parsed.data;

  const material = await db.hmMaterial.findUnique({ where: { id: fields.materialId } });
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const file = formData.get("file") as File | null;
  const publishError = requiresImageBeforePublish(fields.reviewStatus, !!(file && file.size > 0));
  if (publishError) {
    return NextResponse.json({ error: publishError }, { status: 400 });
  }

  let textureAssetUrl: string | null = null;

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
    }

    const product = await createHmProductFromFields(fields, {
      textureAssetUrl,
      evidence: { sourceType: "platform", sourceDetail: `Added via the internal catalogue tool by ${session!.email}` },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("[admin/home-material/products] create failed:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        { error: "Image storage is temporarily unreachable — nothing was saved. Please try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not create product" }, { status: 500 });
  }
}
