/**
 * Generate all 5 real Veo clips for one product's redesigned saree
 * storyboard (front, blouse, pallu, pleats, back) — the "focused crop,
 * every shot is real AI motion" redesign, not the earlier front+back-only
 * hybrid. Sequential (not parallel) to stay predictable against a
 * first-time project's request quota. ~$1.00 total at Veo 3.1 Lite rates.
 *
 * No composer yet (Phase 3, not built) — clips are saved individually, not
 * stitched into one continuous file. Delete after use.
 */
import "dotenv/config";
import { writeFile } from "fs/promises";
import { db } from "../lib/db";
import { storyboardFor } from "../lib/catalogue-motion/storyboards";
import { resolvePreset } from "../lib/catalogue-motion/grammar";
import { constraintsFor, DEFAULT_INTENSITY } from "../lib/catalogue-motion/constraints";
import { buildClipInstruction } from "../lib/catalogue-motion/prompt-builder";
import { resolveShotSources } from "../lib/catalogue-motion/source-resolver";
import { veoMotionProvider } from "../lib/catalogue-motion/provider/veo-provider";

const PRODUCT_ID = "cmso6g53m0002x4lber4d61af"; // Yellow Embroidered Silk Saree
const OUT_DIR = process.argv[2] || ".";

async function main() {
  const product = await db.product.findUnique({
    where: { id: PRODUCT_ID },
    select: {
      id: true,
      title: true,
      category: true,
      generatedImages: { where: { view: { in: ["front", "back"] } }, select: { view: true, url: true } },
    },
  });
  if (!product) throw new Error(`Product ${PRODUCT_ID} not found`);

  const front = product.generatedImages.find((i) => i.view === "front")?.url;
  const back = product.generatedImages.find((i) => i.view === "back")?.url;
  if (!front || !back) throw new Error("Product is missing a front or back catalogue image");

  console.log(`Product: ${product.title} (${product.category})`);

  const storyboard = storyboardFor(product.category);
  const resolved = resolveShotSources(product.category, storyboard.shots, { front, back });
  console.log(`Storyboard "${storyboard.categoryKey}": ${resolved.length} shots, ${storyboard.totalDurationSec}s total\n`);

  if (!veoMotionProvider.isEnabled()) throw new Error("Veo provider is not enabled");

  let totalCost = 0;
  const results: Array<{ view: string; path: string; costUsd: number | null }> = [];

  for (const { shot, imageUrl, cropRegion } of resolved) {
    if (shot.renderMode !== "ai-motion") continue;

    const preset = resolvePreset(shot.presetId);
    if (!preset) throw new Error(`Unknown preset "${shot.presetId}"`);
    const constraints = constraintsFor(DEFAULT_INTENSITY);
    const instruction = buildClipInstruction(preset, DEFAULT_INTENSITY, constraints, shot.durationSec, shot.motionEmphasis);

    console.log(`--- ${shot.view} (${shot.label}) — ${preset.label}${shot.motionEmphasis ? " + gentle sway" : ""} ---`);
    console.log(`Source: ${imageUrl}`);
    const t0 = Date.now();

    const result = await veoMotionProvider.generateClip({
      sourceImageUrl: imageUrl,
      instruction,
      intensity: DEFAULT_INTENSITY,
      constraints,
      durationSec: shot.durationSec,
      cropRegion, // informational only — the source image is already cropped via buildCropUrl
      productId: product.id,
      usage: { feature: "catalogue_motion_storyboard_poc" },
    });

    const outPath = `${OUT_DIR}/saree-${shot.view}.mp4`;
    await writeFile(outPath, Buffer.from(result.videoBase64, "base64"));
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`Done in ${elapsed}s, cost $${result.costUsd}, saved to ${outPath}\n`);

    totalCost += result.costUsd ?? 0;
    results.push({ view: shot.view, path: outPath, costUsd: result.costUsd });
  }

  console.log(`\nAll shots complete. Total cost: $${totalCost.toFixed(2)}`);
  for (const r of results) console.log(`  ${r.view}: ${r.path} ($${r.costUsd})`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
