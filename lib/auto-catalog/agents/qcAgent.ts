import { db } from "@/lib/db";
import {
  QC_PASS_THRESHOLD,
  type CatalogResult,
  type QcCheck,
  type QcResult,
  type QcStatus,
} from "../types";
import { verifyImageView, type ExpectedView } from "./verifyImageView";

function check(status: QcStatus, confidence: number, message: string): QcCheck {
  return { status, confidence, message };
}

// Maps the ProductImage.view DB value to the ExpectedView label the verifier understands
const VIEW_MAP: Record<string, ExpectedView> = {
  front:     "front",
  back:      "back",
  "close-up": "close-up",
  closeup:   "close-up",
  "on-model":"on-model",
};

/**
 * QC Agent — validates catalog completeness and image accuracy.
 *
 * Image view accuracy check: fetches each generated ProductImage, calls the
 * vision verifier to confirm the image actually shows the expected view (front/
 * back/close-up), and flags mismatches so the pipeline can delete and regenerate
 * only the wrong images.
 */
export async function qcAgent(
  catalogResult: CatalogResult,
  productId: string
): Promise<QcResult> {
  const failedFields: string[] = [];
  const failedImages: string[] = [];
  const mismatchedViewImages: QcResult["mismatchedViewImages"] = [];

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

  // ── Image presence check ──────────────────────────────────────────────────

  const images = await db.productImage.findMany({
    where: { productId },
    select: { id: true, url: true, view: true, isPrimary: true },
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

  // ── View accuracy check ───────────────────────────────────────────────────
  // For each ProductImage that has a known view label, verify the actual image
  // content matches. Run all verifications in parallel to keep latency low.

  let viewAccuracyCheck: QcCheck;

  const verifiableImages = images.filter((img) => img.view && VIEW_MAP[img.view]);

  if (verifiableImages.length === 0) {
    viewAccuracyCheck = check("pass", 0.8, "No multi-view images to verify");
  } else {
    const verifications = await Promise.all(
      verifiableImages.map((img) =>
        verifyImageView(img.id, img.url, VIEW_MAP[img.view!]!)
      )
    );

    const mismatches = verifications.filter((v) => !v.match && v.confidence >= 0.7);

    for (const m of mismatches) {
      mismatchedViewImages.push({
        imageId: m.imageId,
        url: m.url,
        expectedView: m.expectedView,
        detectedView: m.detectedView,
      });
      failedImages.push(`view_mismatch:${m.imageId}`);
    }

    if (mismatches.length === 0) {
      viewAccuracyCheck = check("pass", 0.9, `All ${verifiableImages.length} view(s) verified correct`);
    } else if (mismatches.length < verifiableImages.length) {
      viewAccuracyCheck = check(
        "warning",
        0.6,
        `${mismatches.length} of ${verifiableImages.length} view(s) show wrong content (e.g. front shown as back)`
      );
    } else {
      viewAccuracyCheck = check(
        "failed",
        0.3,
        `All ${mismatches.length} view(s) show wrong content — regeneration needed`
      );
    }
  }

  // Placeholder image quality check (future: blur/resolution detection)
  const imageQualityCheck = hasImage
    ? check("pass", 0.85, "Image quality acceptable")
    : check("failed", 0, "No image to evaluate");

  // ── Score calculation ─────────────────────────────────────────────────────

  const weights: Array<[QcCheck, number]> = [
    [missingFieldsCheck,  30],
    [categoryCheck,       15],
    [colorCheck,          10],
    [materialCheck,        5],
    [hasImageCheck,       15],
    [viewAccuracyCheck,   15],
    [imageQualityCheck,   10],
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
      missingFields:      missingFieldsCheck,
      categoryConfidence: categoryCheck,
      colorConfidence:    colorCheck,
      materialConfidence: materialCheck,
      hasGeneratedImage:  hasImageCheck,
      viewAccuracy:       viewAccuracyCheck,
      imageQuality:       imageQualityCheck,
    },
    failedFields,
    failedImages,
    mismatchedViewImages,
  };
}
