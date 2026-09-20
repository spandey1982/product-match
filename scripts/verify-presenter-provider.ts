/**
 * M1 verification — proves the real veoPresenterProvider wrapper (not the
 * throwaway POC script) works end-to-end: submit, poll, download, cost
 * estimate. Reuses the suit test case from the M0 spike for a clean
 * before/after comparison against a known-good result.
 *
 * Usage: npx tsx scripts/verify-presenter-provider.ts
 */
import "dotenv/config";
import fs from "node:fs/promises";
import { veoPresenterProvider } from "../lib/presenter-reel/provider/veo-presenter-provider";

async function main() {
  console.log("isEnabled():", veoPresenterProvider.isEnabled());
  console.log("estimateCost(8):", veoPresenterProvider.estimateCost(8));

  const result = await veoPresenterProvider.generateClip({
    sourceImageUrl: "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1785044599/product-match/tryon-vertex/nd2aqbfebchv8rn6ou0v.png",
    script: "Hey! Just look at this stunning burgundy suit — the tailored fit is amazing, perfect for weddings and parties.",
    durationSec: 8,
  });

  console.log("Result:", {
    mimeType: result.mimeType,
    durationMs: result.durationMs,
    width: result.width,
    height: result.height,
    costUsd: result.costUsd,
    provider: result.provider,
    model: result.model,
    videoBytes: Buffer.from(result.videoBase64, "base64").length,
  });

  const outPath = `m1-verification-${Date.now()}.mp4`;
  await fs.writeFile(outPath, Buffer.from(result.videoBase64, "base64"));
  console.log("Saved:", outPath);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
