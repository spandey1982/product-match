import { db } from "@/lib/db";
import { fabricAnalysisAgent } from "./agents/fabricAnalysisAgent";
import { designUnderstandingAgent } from "./agents/designUnderstandingAgent";
import { accessoryUnderstandingAgent } from "./agents/accessoryUnderstandingAgent";
import { plannerAgent } from "./agents/plannerAgent";
import { garmentConstructionAgent } from "./agents/garmentConstructionAgent";

async function setStage(designId: string, stage: string) {
  await db.fashionDesign.update({ where: { id: designId }, data: { stage } });
}

export async function runDesignPipeline(designId: string): Promise<void> {
  const design = await db.fashionDesign.findUnique({
    where: { id: designId },
    include: { assets: true },
  });
  if (!design) return;

  const { garmentType, assets } = design;

  const byType = (type: string) => assets.filter((a) => a.assetType === type);
  const urlsOf = (type: string) => byType(type).map((a) => a.url);

  try {
    // ── Stage 1: Fabric Analysis ────────────────────────────────────────────
    await setStage(designId, "analyzing_fabric");

    const fabricUrls = urlsOf("fabric");
    if (fabricUrls.length === 0) {
      await db.fashionDesign.update({
        where: { id: designId },
        data: { stage: "failed", failureReason: "No fabric images uploaded" },
      });
      return;
    }

    const fabricAnalysis = await fabricAnalysisAgent(fabricUrls);
    await db.fashionDesign.update({
      where: { id: designId },
      data: { fabricAnalysis: JSON.stringify(fabricAnalysis) },
    });

    // ── Stage 2: Design Understanding ───────────────────────────────────────
    await setStage(designId, "analyzing_design");

    const sketchUrls = [...urlsOf("sketch"), ...urlsOf("reference")];
    const designUnderstanding = await designUnderstandingAgent(sketchUrls, garmentType);
    await db.fashionDesign.update({
      where: { id: designId },
      data: { designUnderstanding: JSON.stringify(designUnderstanding) },
    });

    // ── Stage 3: Accessory Understanding ────────────────────────────────────
    await setStage(designId, "analyzing_accessories");

    const accessoryAssets = assets
      .filter((a) => ["accessory", "border", "neck", "sleeve", "back"].includes(a.assetType))
      .map((a) => ({ url: a.url, assetType: a.assetType, mimeType: a.mimeType }));

    const accessoryAnalysis = await accessoryUnderstandingAgent(accessoryAssets);
    await db.fashionDesign.update({
      where: { id: designId },
      data: { accessoryAnalysis: JSON.stringify(accessoryAnalysis) },
    });

    // ── Stage 4: Planning ────────────────────────────────────────────────────
    await setStage(designId, "planning");

    const generationPlan = await plannerAgent(
      fabricAnalysis,
      designUnderstanding,
      accessoryAnalysis,
      garmentType
    );
    await db.fashionDesign.update({
      where: { id: designId },
      data: { generationPlan: JSON.stringify(generationPlan) },
    });

    // ── Stage 5: Garment Construction + Flat Image Generation ───────────────
    await setStage(designId, "constructing");

    const { flatFrontUrl, flatBackUrl } = await garmentConstructionAgent(generationPlan, fabricUrls);

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
    console.error(`[fashion-designer] pipeline error for design ${designId}:`, err);
    await db.fashionDesign.update({
      where: { id: designId },
      data: { stage: "failed", failureReason: String(err) },
    }).catch(() => {});
  }
}
