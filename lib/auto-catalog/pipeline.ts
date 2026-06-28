/**
 * Pipeline orchestrator — runs one AutoCatalogItem through all stages
 * sequentially. Failures are isolated: one item failing never blocks others.
 */
import { db } from "@/lib/db";
import { classificationAgent, isBelowThreshold } from "./agents/classificationAgent";
import { catalogAgent } from "./agents/catalogAgent";
import { imageAgent } from "./agents/imageAgent";
import { qcAgent } from "./agents/qcAgent";
import { serializeArray } from "@/lib/serialize";
import type { CatalogResult, ClassificationResult } from "./types";

async function setStage(itemId: string, stage: string) {
  await db.autoCatalogItem.update({ where: { id: itemId }, data: { stage } });
}

async function bumpCount(batchId: string, field: string) {
  await db.autoCatalogBatch.update({
    where: { id: batchId },
    data: { [field]: { increment: 1 } },
  });
}

export async function runPipeline(itemId: string): Promise<void> {
  const item = await db.autoCatalogItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  const { batchId, userId, imageUrl } = item;

  try {
    // ── Stage 2: Classification ───────────────────────────────────────────
    await setStage(itemId, "classifying");

    let classification: ClassificationResult;
    try {
      classification = await classificationAgent(imageUrl, userId);
    } catch (err) {
      await db.autoCatalogItem.update({
        where: { id: itemId },
        data: { stage: "failed", failureReason: `Classification error: ${String(err)}` },
      });
      return;
    }

    await db.autoCatalogItem.update({
      where: { id: itemId },
      data: { classificationResult: JSON.stringify(classification) },
    });

    if (isBelowThreshold(classification.confidence)) {
      await setStage(itemId, "unknown");
      await bumpCount(batchId, "unknownCount");
      return; // Paused — awaits merchant category assignment
    }

    await bumpCount(batchId, "classifiedCount");

    // ── Stage 3: Catalog Generation ───────────────────────────────────────
    await setStage(itemId, "cataloging");

    let catalogResult: CatalogResult;
    try {
      catalogResult = await catalogAgent(imageUrl, classification.category, userId);
    } catch (err) {
      await db.autoCatalogItem.update({
        where: { id: itemId },
        data: { stage: "failed", failureReason: `Catalog error: ${String(err)}` },
      });
      return;
    }

    await db.autoCatalogItem.update({
      where: { id: itemId },
      data: { catalogResult: JSON.stringify(catalogResult) },
    });
    await bumpCount(batchId, "catalogedCount");

    // ── Stage 4: Create product + Image Generation ────────────────────────
    await setStage(itemId, "generating_images");

    // Create a draft product so image generation has a product to attach to
    const title = String(catalogResult.title.value) || "Untitled Product";
    const category = String(catalogResult.category.value);
    const color = String(catalogResult.color.value) || "Unknown";
    const price = Number(catalogResult.price.value) || 0;

    const draftProduct = await db.product.create({
      data: {
        title,
        description: String(catalogResult.description.value),
        category,
        subcategory: String(catalogResult.subcategory.value) || null,
        color,
        colors: serializeArray([color]),
        occasion: serializeArray(
          Array.isArray(catalogResult.occasion.value)
            ? (catalogResult.occasion.value as string[])
            : []
        ),
        styleTags: serializeArray(
          Array.isArray(catalogResult.styleTags.value)
            ? (catalogResult.styleTags.value as string[])
            : []
        ),
        material: String(catalogResult.material.value) || null,
        pattern: String(catalogResult.pattern.value) || null,
        gender: String(catalogResult.gender.value) || "WOMEN",
        season: serializeArray(
          Array.isArray(catalogResult.season.value)
            ? (catalogResult.season.value as string[])
            : []
        ),
        price,
        imageUrl,
        isActive: false, // draft until published
        userId,
      },
    });

    await db.autoCatalogItem.update({
      where: { id: itemId },
      data: { productId: draftProduct.id },
    });

    try {
      await imageAgent(draftProduct.id, userId);
    } catch {
      // Non-fatal — QC will flag missing image
    }
    await bumpCount(batchId, "imagedCount");

    // ── Stage 5: QC ───────────────────────────────────────────────────────
    await setStage(itemId, "qc_running");

    const qcResult = await qcAgent(catalogResult, draftProduct.id);
    await db.autoCatalogItem.update({
      where: { id: itemId },
      data: { qcResult: JSON.stringify(qcResult) },
    });

    if (qcResult.overall === "pass" || qcResult.overall === "warning") {
      await bumpCount(batchId, "qcPassedCount");
      // Publish directly
      await db.product.update({ where: { id: draftProduct.id }, data: { isActive: true } });
      await db.autoCatalogItem.update({ where: { id: itemId }, data: { stage: "published" } });
      await bumpCount(batchId, "publishedCount");
      return;
    }

    // ── Stage 6: Auto Retry ───────────────────────────────────────────────
    await setStage(itemId, "retrying");
    await bumpCount(batchId, "retryingCount");

    // Re-run catalog for failed fields only, then re-run images if needed
    let retryCatalog = catalogResult;
    if (qcResult.failedFields.length > 0) {
      try {
        retryCatalog = await catalogAgent(imageUrl, category, userId);
        await db.autoCatalogItem.update({
          where: { id: itemId },
          data: { catalogResult: JSON.stringify(retryCatalog), retryCount: { increment: 1 } },
        });
      } catch {
        // Keep original catalog if retry fails
      }
    }

    if (qcResult.failedImages.length > 0) {
      try {
        await imageAgent(draftProduct.id, userId);
      } catch {
        // Non-fatal
      }
    }

    // ── Stage 7: Second QC ────────────────────────────────────────────────
    await setStage(itemId, "qc_running");

    const qcResult2 = await qcAgent(retryCatalog, draftProduct.id);
    await db.autoCatalogItem.update({
      where: { id: itemId },
      data: { qcResult: JSON.stringify(qcResult2) },
    });

    if (qcResult2.overall === "pass" || qcResult2.overall === "warning") {
      await db.product.update({ where: { id: draftProduct.id }, data: { isActive: true } });
      await db.autoCatalogItem.update({ where: { id: itemId }, data: { stage: "published" } });
      await bumpCount(batchId, "publishedCount");
    } else {
      // Send to manual QC
      await setStage(itemId, "manual_qc");
      await bumpCount(batchId, "manualQcCount");
    }
  } catch (err) {
    console.error(`[auto-catalog] pipeline error for item ${itemId}:`, err);
    await db.autoCatalogItem.update({
      where: { id: itemId },
      data: { stage: "failed", failureReason: String(err) },
    }).catch(() => {});
  }
}
