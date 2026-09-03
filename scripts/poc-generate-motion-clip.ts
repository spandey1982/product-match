/**
 * Phase 2 live POC — generate ONE real motion clip via Veo for one product's
 * front hero shot. This is the first real paid call in the catalogue-motion
 * feature; everything before this point (types, storyboards, prompt
 * builder, provider abstraction) was verified statically only.
 *
 * Scope: a single ai-motion shot end-to-end (source image -> instruction ->
 * Veo -> saved video), NOT the full multi-shot storyboard or composer —
 * those are Phase 3 (orchestrator + FFmpeg pan-zoom + stitching), not yet
 * built. This script exists purely to validate the Veo integration works
 * against a real product image before building the rest of the pipeline
 * on top of it. Delete after use.
 */
import "dotenv/config";
import { writeFile } from "fs/promises";
import { db } from "../lib/db";
import { storyboardFor } from "../lib/catalogue-motion/storyboards";
import { resolvePreset } from "../lib/catalogue-motion/grammar";
import { constraintsFor, DEFAULT_INTENSITY } from "../lib/catalogue-motion/constraints";
import { buildClipInstruction } from "../lib/catalogue-motion/prompt-builder";
import { veoMotionProvider } from "../lib/catalogue-motion/provider/veo-provider";

const PRODUCT_ID = "cmso6g53m0002x4lber4d61af"; // Yellow Embroidered Silk Saree
const OUT_PATH = process.argv[2] || "./scratchpad-motion-clip.mp4";

async function main() {
  const product = await db.product.findUnique({
    where: { id: PRODUCT_ID },
    select: {
      id: true,
      title: true,
      category: true,
      generatedImages: { where: { view: "front" }, select: { url: true }, take: 1 },
    },
  });
  if (!product) throw new Error(`Product ${PRODUCT_ID} not found`);
  const frontUrl = product.generatedImages[0]?.url;
  if (!frontUrl) throw new Error(`Product ${PRODUCT_ID} has no front catalogue image`);

  console.log(`Product: ${product.title} (${product.category})`);
  console.log(`Front image: ${frontUrl}`);

  const storyboard = storyboardFor(product.category);
  const frontShot = storyboard.shots.find((s) => s.view === "front" && s.renderMode === "ai-motion");
  if (!frontShot) throw new Error(`No ai-motion front shot in storyboard "${storyboard.categoryKey}"`);

  const preset = resolvePreset(frontShot.presetId);
  if (!preset) throw new Error(`Unknown preset "${frontShot.presetId}"`);
  const constraints = constraintsFor(DEFAULT_INTENSITY);
  const instruction = buildClipInstruction(preset, DEFAULT_INTENSITY, constraints, frontShot.durationSec);

  console.log(`\nShot: ${frontShot.label} (${preset.label}, requested ${frontShot.durationSec}s)`);
  console.log(`Instruction: ${instruction.text}`);

  const estimatedCost = veoMotionProvider.estimateCost(frontShot.durationSec);
  console.log(`\nEstimated cost: $${estimatedCost} USD`);
  console.log(`Provider enabled: ${veoMotionProvider.isEnabled()}`);
  if (!veoMotionProvider.isEnabled()) throw new Error("Veo provider is not enabled — check ENABLE_CATALOGUE_MOTION and credentials");

  console.log("\nSubmitting to Veo... (this can take 30s-2min, polling every 5s)");
  const t0 = Date.now();

  const result = await veoMotionProvider.generateClip({
    sourceImageUrl: frontUrl,
    instruction,
    intensity: DEFAULT_INTENSITY,
    constraints,
    durationSec: frontShot.durationSec,
    productId: product.id,
    usage: { feature: "catalogue_motion_poc" },
  });

  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`Model: ${result.model}`);
  console.log(`Mime: ${result.mimeType}`);
  console.log(`Actual cost: $${result.costUsd} USD`);
  console.log(`Dimensions: ${result.width}x${result.height}`);

  const buffer = Buffer.from(result.videoBase64, "base64");
  await writeFile(OUT_PATH, buffer);
  console.log(`\nSaved ${(buffer.length / 1024).toFixed(0)} KB to ${OUT_PATH}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
