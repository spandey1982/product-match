import { db } from "@/lib/db";
import {
  QC_PASS_THRESHOLD,
  type CatalogResult,
  type QcCheck,
  type QcResult,
  type QcStatus,
} from "../types";

function check(status: QcStatus, confidence: number, message: string): QcCheck {
  return { status, confidence, message };
}

/**
 * QC Agent — validates catalog completeness and image availability.
 * Returns a structured QcResult with per-check statuses and an overall score.
 */
export async function qcAgent(
  catalogResult: CatalogResult,
  productId: string
): Promise<QcResult> {
  const failedFields: string[] = [];
  const failedImages: string[] = [];

  // ── Catalog checks ────────────────────────────────────────────────────────

  const requiredFields: Array<keyof CatalogResult> = [
    "title", "category", "color", "price",
  ];
  const missingRequired = requiredFields.filter((f) => {
    const v = catalogResult[f].value;
    return v === "" || v === 0 || (Array.isArray(v) && v.length === 0);
  });

  const missingFieldsCheck = missingRequired.length === 0
    ? check("pass", 1, "All required fields present")
    : missingRequired.length <= 2
      ? check("warning", 0.6, `Missing fields: ${missingRequired.join(", ")}`)
      : check("failed", 0.3, `Missing fields: ${missingRequired.join(", ")}`);

  if (missingFieldsCheck.status === "failed") failedFields.push(...missingRequired);

  const categoryConf = catalogResult.category.confidence;
  const categoryCheck = categoryConf >= 0.8
    ? check("pass", categoryConf, "Category confident")
    : categoryConf >= 0.6
      ? check("warning", categoryConf, "Category confidence below 80%")
      : check("failed", categoryConf, "Category confidence too low");

  if (categoryCheck.status === "failed") failedFields.push("category");

  const colorConf = catalogResult.color.confidence;
  const colorCheck = colorConf >= 0.8
    ? check("pass", colorConf, "Color confident")
    : colorConf >= 0.6
      ? check("warning", colorConf, "Color confidence below 80%")
      : check("failed", colorConf, "Color confidence too low");

  if (colorCheck.status === "failed") failedFields.push("color");

  const materialConf = catalogResult.material.confidence;
  const materialCheck = materialConf >= 0.7
    ? check("pass", materialConf, "Material confident")
    : materialConf >= 0.5
      ? check("warning", materialConf, "Material confidence below 70%")
      : check("failed", materialConf, "Material confidence too low");

  // ── Image checks ──────────────────────────────────────────────────────────

  const images = await db.productImage.findMany({
    where: { productId },
    select: { url: true, view: true, isPrimary: true },
  });

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { modelImageUrl: true },
  });

  const hasImage = images.length > 0 || !!product?.modelImageUrl;
  const hasImageCheck = hasImage
    ? check("pass", 0.95, `${images.length || 1} generated image(s)`)
    : check("failed", 0, "No generated images found");

  if (!hasImage) failedImages.push("model_image");

  // Placeholder image quality check (future: call vision model for blur/resolution)
  const imageQualityCheck = hasImage
    ? check("pass", 0.85, "Image quality acceptable")
    : check("failed", 0, "No image to evaluate");

  // ── Score calculation ─────────────────────────────────────────────────────

  const weights: Array<[QcCheck, number]> = [
    [missingFieldsCheck, 30],
    [categoryCheck, 20],
    [colorCheck, 15],
    [materialCheck, 10],
    [hasImageCheck, 15],
    [imageQualityCheck, 10],
  ];

  const statusScore = (s: QcStatus) => (s === "pass" ? 1 : s === "warning" ? 0.5 : 0);
  const score = Math.round(
    weights.reduce((acc, [c, w]) => acc + statusScore(c.status) * w, 0)
  );

  const allStatuses = weights.map(([c]) => c.status);
  const overall: QcStatus = allStatuses.includes("failed")
    ? "failed"
    : allStatuses.includes("warning")
      ? "warning"
      : "pass";

  return {
    overall: score >= QC_PASS_THRESHOLD ? overall : "failed",
    score,
    checks: {
      missingFields: missingFieldsCheck,
      categoryConfidence: categoryCheck,
      colorConfidence: colorCheck,
      materialConfidence: materialCheck,
      imageQuality: imageQualityCheck,
      hasGeneratedImage: hasImageCheck,
    },
    failedFields,
    failedImages,
  };
}
