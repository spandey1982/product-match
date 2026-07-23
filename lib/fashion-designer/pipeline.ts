import { db } from "@/lib/db";
import { fabricAnalysisAgent } from "./agents/fabricAnalysisAgent";
import { designUnderstandingAgent } from "./agents/designUnderstandingAgent";
import { accessoryUnderstandingAgent } from "./agents/accessoryUnderstandingAgent";
import { plannerAgent } from "./agents/plannerAgent";
import { garmentConstructionAgent } from "./agents/garmentConstructionAgent";
import { findTemplate, defaultOptionsFor } from "./templates";
import type { AiUsageContext } from "@/lib/ai-usage/record";
import { chargeForCall } from "@/lib/billing/charge";

async function setStage(designId: string, stage: string) {
  await db.fashionDesign.update({ where: { id: designId }, data: { stage } });
}

async function isCancelled(designId: string): Promise<boolean> {
  const d = await db.fashionDesign.findUnique({
    where: { id: designId },
    select: { cancelRequested: true },
  });
  return d?.cancelRequested ?? false;
}

async function abort(designId: string) {
  await db.fashionDesign.update({
    where: { id: designId },
    data: { stage: "failed", failureReason: "Cancelled by user", cancelRequested: false },
  });
}

async function failAtStage(designId: string, stage: string, reason: string) {
  await db.fashionDesign.update({
    where: { id: designId },
    data: { stage: "failed", failedAtStage: stage, failureReason: reason },
  }).catch(() => {});
}

export async function runDesignPipeline(designId: string, userId?: string): Promise<void> {
  const design = await db.fashionDesign.findUnique({
    where: { id: designId },
    include: { assets: true },
  });
  if (!design) return;

  const effectiveUserId = userId ?? design.userId;
  const { garmentType, assets } = design;

  const byType = (type: string) => assets.filter((a) => a.assetType === type);
  const urlsOf = (type: string) => byType(type).map((a) => a.url);

  const template = findTemplate(design.templateId);
  const savedOptions = ((): Record<string, string> => {
    try {
      return design.structuredOptions ? JSON.parse(design.structuredOptions) : {};
    } catch {
      return {};
    }
  })();
  const structuredOptions: Record<string, string> = template
    ? { ...defaultOptionsFor(template), ...savedOptions }
    : {};
  const designNotes = design.designNotes ?? "";

  await db.fashionDesign.update({
    where: { id: designId },
    data: { cancelRequested: false, failedAtStage: null, failureReason: null },
  });

  const usage: AiUsageContext = {
    feature: "fashion_designer",
    storeId: effectiveUserId,
    userId: effectiveUserId,
  };

  // ── Stage 1: Fabric Analysis ──────────────────────────────────────────
  let fabricAnalysis = design.fabricAnalysis ? JSON.parse(design.fabricAnalysis) : null;
  if (!fabricAnalysis) {
    await setStage(designId, "analyzing_fabric");

    const fabricUrls = urlsOf("fabric");
    if (fabricUrls.length === 0) {
      await failAtStage(designId, "analyzing_fabric", "No fabric images uploaded");
      return;
    }

    const charge = await chargeForCall(effectiveUserId, "fashion_design_analysis");
    if ("insufficientCredits" in charge) {
      await failAtStage(designId, "analyzing_fabric", "Insufficient credits to continue. Add credits and resume.");
      return;
    }

    try {
      fabricAnalysis = await fabricAnalysisAgent(fabricUrls, usage);
      await db.fashionDesign.update({
        where: { id: designId },
        data: { fabricAnalysis: JSON.stringify(fabricAnalysis) },
      });
    } catch (err) {
      console.error(`[fashion-designer] fabric analysis failed for ${designId}:`, err);
      await failAtStage(designId, "analyzing_fabric", String(err));
      return;
    }
  }

  if (await isCancelled(designId)) { await abort(designId); return; }

  // ── Stage 2: Design Understanding ─────────────────────────────────────
  let designUnderstanding = design.designUnderstanding ? JSON.parse(design.designUnderstanding) : null;
  if (!designUnderstanding) {
    await setStage(designId, "analyzing_design");

    const charge = await chargeForCall(effectiveUserId, "fashion_design_analysis");
    if ("insufficientCredits" in charge) {
      await failAtStage(designId, "analyzing_design", "Insufficient credits to continue. Add credits and resume.");
      return;
    }

    try {
      const sketchUrls = [...urlsOf("sketch"), ...urlsOf("reference")];
      designUnderstanding = await designUnderstandingAgent(sketchUrls, garmentType, usage);
      await db.fashionDesign.update({
        where: { id: designId },
        data: { designUnderstanding: JSON.stringify(designUnderstanding) },
      });
    } catch (err) {
      console.error(`[fashion-designer] design understanding failed for ${designId}:`, err);
      await failAtStage(designId, "analyzing_design", String(err));
      return;
    }
  }

  if (await isCancelled(designId)) { await abort(designId); return; }

  // ── Stage 3: Accessory Understanding ──────────────────────────────────
  let accessoryAnalysis = design.accessoryAnalysis ? JSON.parse(design.accessoryAnalysis) : null;
  if (!accessoryAnalysis) {
    await setStage(designId, "analyzing_accessories");

    const charge = await chargeForCall(effectiveUserId, "fashion_design_analysis");
    if ("insufficientCredits" in charge) {
      await failAtStage(designId, "analyzing_accessories", "Insufficient credits to continue. Add credits and resume.");
      return;
    }

    try {
      const accessoryAssets = assets
        .filter((a) => ["accessory", "border", "neck", "sleeve", "back"].includes(a.assetType))
        .map((a) => ({ url: a.url, assetType: a.assetType, mimeType: a.mimeType }));

      accessoryAnalysis = await accessoryUnderstandingAgent(accessoryAssets, usage);
      await db.fashionDesign.update({
        where: { id: designId },
        data: { accessoryAnalysis: JSON.stringify(accessoryAnalysis) },
      });
    } catch (err) {
      console.error(`[fashion-designer] accessory understanding failed for ${designId}:`, err);
      await failAtStage(designId, "analyzing_accessories", String(err));
      return;
    }
  }

  if (await isCancelled(designId)) { await abort(designId); return; }

  // ── Stage 4: Planning ─────────────────────────────────────────────────
  let generationPlan = design.generationPlan ? JSON.parse(design.generationPlan) : null;
  if (!generationPlan) {
    await setStage(designId, "planning");

    const charge = await chargeForCall(effectiveUserId, "fashion_design_analysis");
    if ("insufficientCredits" in charge) {
      await failAtStage(designId, "planning", "Insufficient credits to continue. Add credits and resume.");
      return;
    }

    try {
      generationPlan = await plannerAgent(
        fabricAnalysis,
        designUnderstanding,
        accessoryAnalysis,
        garmentType,
        template,
        structuredOptions,
        designNotes,
        usage
      );
      await db.fashionDesign.update({
        where: { id: designId },
        data: { generationPlan: JSON.stringify(generationPlan) },
      });
    } catch (err) {
      console.error(`[fashion-designer] planning failed for ${designId}:`, err);
      await failAtStage(designId, "planning", String(err));
      return;
    }
  }

  if (await isCancelled(designId)) { await abort(designId); return; }

  // ── Stage 5: Garment Construction + Flat Image Generation ─────────────
  if (!design.flatFrontUrl) {
    await setStage(designId, "constructing");

    const charge = await chargeForCall(effectiveUserId, "fashion_design_gen");
    if ("insufficientCredits" in charge) {
      await failAtStage(designId, "constructing", "Insufficient credits to continue. Add credits and resume.");
      return;
    }

    try {
      const referenceUrls = [
        ...urlsOf("fabric"),
        ...urlsOf("sketch"),
        ...urlsOf("reference"),
        ...urlsOf("neck"),
        ...urlsOf("sleeve"),
        ...urlsOf("back"),
        ...urlsOf("border"),
      ];

      const { flatFrontUrl, flatBackUrl } = await garmentConstructionAgent(generationPlan, referenceUrls, usage);

      await setStage(designId, "generating_flat_images");

      await db.fashionDesign.update({
        where: { id: designId },
        data: {
          flatFrontUrl,
          flatBackUrl,
          stage: "completed",
          qualityScore: flatFrontUrl ? 80 : 0,
        },
      });
    } catch (err) {
      console.error(`[fashion-designer] garment construction failed for ${designId}:`, err);
      await failAtStage(designId, "constructing", String(err));
      return;
    }
  } else {
    await db.fashionDesign.update({
      where: { id: designId },
      data: { stage: "completed" },
    });
  }
}
