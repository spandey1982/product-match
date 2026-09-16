/**
 * Shared HmProduct creation — used by both the single-entry admin form
 * (POST /api/admin/home-material/products) and PDF bulk-import approval
 * (PATCH .../catalogue-imports/[id]/pages/[pageId]) so the two entry paths
 * can never drift on what fields a "real" catalogue product gets.
 */
import { db } from "@/lib/db";
import { recordProductEvidence, type EvidenceSourceType } from "@/lib/home-material/provenance";
import { deriveColorFamily } from "@/lib/home-material/color-family";
import { serializeArray } from "@/lib/serialize";
import type { ProductFieldData } from "@/lib/home-material/product-form";

export async function createHmProductFromFields(
  fields: ProductFieldData,
  opts: {
    textureAssetUrl?: string | null;
    evidence: { sourceType: EvidenceSourceType; sourceDetail: string };
  }
) {
  const imageUrls = opts.textureAssetUrl ? serializeArray([opts.textureAssetUrl]) : "[]";

  const product = await db.hmProduct.create({
    data: {
      materialId: fields.materialId,
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
      familyId: fields.familyId,
      textureAssetUrl: opts.textureAssetUrl ?? null,
      imageUrls,
      uploadedByHmUserId: null,
    },
  });

  await recordProductEvidence({
    productId: product.id,
    field: "name",
    value: fields.name,
    sourceType: opts.evidence.sourceType,
    sourceDetail: opts.evidence.sourceDetail,
  });

  return product;
}
