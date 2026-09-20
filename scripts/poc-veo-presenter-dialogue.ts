/**
 * POC — does raw Veo 3.1 (our existing Vertex account, same credentials as
 * lib/catalogue-motion/provider/veo-provider.ts) produce a lip-synced,
 * gesturing presenter from a single reference photo + a dialogue prompt?
 *
 * This is the exact script (recreated from the same session that wrote and
 * ran it — not a reconstruction from memory) used for the AI Presenter Reel
 * M0 validation spike, 2026-09-19/20. Ran 4 times total against 3 different
 * products; see the TEST_CASES array below for each exact prompt used.
 *
 * NOT wired into the app. Standalone, run manually. Does not import from or
 * modify veo-provider.ts — the existing image-to-video reel engine (camera
 * motion only, generateAudio always false) stays untouched; this calls the
 * same Vertex endpoints directly with generateAudio: true and a
 * dialogue-carrying prompt instead.
 *
 * Usage:
 *   npx tsx scripts/poc-veo-presenter-dialogue.ts <case-name>
 *   npx tsx scripts/poc-veo-presenter-dialogue.ts suit
 *   npx tsx scripts/poc-veo-presenter-dialogue.ts saree
 *   npx tsx scripts/poc-veo-presenter-dialogue.ts sherwani
 *
 * Each run costs real money on the Google Cloud billing account tied to
 * GOOGLE_CLOUD_PROJECT — Standard-tier Veo 3.1 is billed per second
 * (~$0.40/sec observed), and every run here requests the max 8s duration,
 * so budget ~$3.20 per invocation.
 */
import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import fs from "node:fs/promises";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 36; // ~3 minutes

// ── The exact three test cases run for the M0 spike ─────────────────────

interface TestCase {
  label: string;
  /** Branding-stripped Cloudinary URL of a real generated on-model photo already in the catalogue (see lib/model-gen/crop-templates.ts's stripDeliveryTransforms). */
  imageUrl: string;
  /** The exact prompt sent to Veo — dialogue in quotes plus a gesture instruction plus an explicit "everything else stays as photographed" constraint. */
  prompt: string;
}

const TEST_CASES: Record<string, TestCase> = {
  // Run 1 of 4 — solid-colour control case (Men's Burgundy Suit, product id cms1dg64500avaclbxgl44sdb).
  suit: {
    label: "SUIT (solid, low risk)",
    imageUrl: "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1785044599/product-match/tryon-vertex/nd2aqbfebchv8rn6ou0v.png",
    prompt:
      "The man in the photo stands in place and speaks directly to camera with natural lip-sync, saying in a warm, enthusiastic voice: " +
      '"Hey! Just look at this stunning burgundy suit — the tailored fit is amazing, perfect for weddings and parties." ' +
      "While speaking he gestures naturally with both hands, occasionally touching the lapel of the jacket. " +
      "His pose, the suit, the background, and the lighting stay exactly as in the photo — only his face, mouth, and hands move naturally as he talks.",
  },
  // Run 2 of 4 — first saree run (Peach Embroidered Saree with Golden Border, product id cmsiy1d3y015zp8lbos2spmve).
  // Run 3 of 4 was an exact repeat of this same case, to test run-to-run reliability.
  saree: {
    label: "SAREE (patterned, high risk)",
    imageUrl: "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1786149856/product-match/models/awuzwytfotycj19bajq1.jpg",
    prompt:
      "The woman in the photo stands in place and speaks directly to camera with natural lip-sync, saying in a warm, enthusiastic voice: " +
      '"Hi everyone! This gorgeous peach saree has the most beautiful gold embroidery all over it — just look at this pallu, isn\'t it stunning?" ' +
      "While speaking she gestures naturally with both hands, at one point gesturing toward the embroidered pallu draped over her shoulder. " +
      "Her pose, the saree, its embroidery and border, the background, and the lighting stay exactly as in the photo — only her face, mouth, and hands move naturally as she talks.",
  },
  // Run 4 of 4 — fresh random product per the diverse-category testing convention
  // (Embroidered Sherwani, product id cmrwtoctz027caglbninz67u4, dense all-over pattern).
  sherwani: {
    label: "SHERWANI (dense all-over pattern, fresh product)",
    imageUrl: "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1784769546/product-match/tryon-vertex/stcushg2z3ibiy2udv5f.png",
    prompt:
      "The man in the photo stays seated in place and speaks directly to camera with natural lip-sync, saying in a warm, confident voice: " +
      '"Hey! Check out this stunning ivory sherwani — look at this intricate embroidery work, it\'s absolutely perfect for weddings and grand occasions." ' +
      "While speaking he gestures naturally with both hands, at one point running a hand down the embroidered front panel of the jacket to show it off. " +
      "His pose, the sherwani, its embroidery pattern, the background, and the lighting stay exactly as in the photo — only his face, mouth, and hands move naturally as he talks.",
  },
};

// ── Vertex plumbing — same auth pattern and endpoint shape as veo-provider.ts ─

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("Failed to obtain Google Cloud access token");
  return token;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source image (HTTP ${res.status})`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { data, mimeType };
}

/**
 * The exact request body sent to Veo. Two deliberate differences from
 * veo-provider.ts's buildRequestBody(): generateAudio is true (that file
 * hardcodes false — Catalogue Motion is silent by design), and the model id
 * is the Standard tier "veo-3.1-generate-001" rather than the Lite tier
 * "veo-3.1-lite-generate-001" veo-provider.ts defaults to on Vertex — the
 * Lite tier does not support audio.
 */
async function submit(
  projectId: string,
  location: string,
  model: string,
  accessToken: string,
  prompt: string,
  imageBase64: string,
  imageMime: string
): Promise<string> {
  const endpoint =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

  const body = {
    instances: [{ prompt, image: { bytesBase64Encoded: imageBase64, mimeType: imageMime } }],
    parameters: {
      durationSeconds: 8, // Veo's max per call — same 4/6/8-only constraint veo-provider.ts works around
      sampleCount: 1,
      aspectRatio: "9:16",
      resolution: "720p",
      generateAudio: true, // <- the key difference from the existing (silent) catalogue reel engine
      personGeneration: "allow_adult",
      safetySetting: "block_only_high",
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Submit failed (${res.status}): ${text.slice(0, 500)}`);
  const data = JSON.parse(text) as { name?: string };
  if (!data.name) throw new Error(`No operation name returned: ${text.slice(0, 500)}`);
  return data.name;
}

async function poll(projectId: string, location: string, model: string, operationName: string) {
  const endpoint =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${model}:fetchPredictOperation`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const accessToken = await getAccessToken();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ operationName }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Poll failed (${res.status}): ${text.slice(0, 500)}`);
    const data = JSON.parse(text) as {
      done?: boolean;
      error?: { code: number; message: string };
      response?: { videos?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
    };
    console.log(`  poll ${attempt + 1}/${MAX_POLL_ATTEMPTS}: done=${!!data.done}`);
    if (data.error) throw new Error(`Operation failed: ${data.error.message}`);
    if (data.done) return data;
  }
  throw new Error("Timed out waiting for operation");
}

async function main() {
  const caseName = process.argv[2];
  const testCase = caseName ? TEST_CASES[caseName] : undefined;
  if (!testCase) {
    console.error(`Usage: npx tsx scripts/poc-veo-presenter-dialogue.ts <${Object.keys(TEST_CASES).join("|")}>`);
    process.exit(1);
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT not set");
  const model = "veo-3.1-generate-001";

  console.log(`\n=== ${testCase.label} ===`);
  console.log(`Model: ${model} | Project: ${projectId} | Location: ${location}`);
  console.log(`Source image: ${testCase.imageUrl}`);
  console.log(`Prompt sent to Veo:\n"${testCase.prompt}"\n`);

  const accessToken = await getAccessToken();
  const { data: imageBase64, mimeType } = await fetchImageAsBase64(testCase.imageUrl);
  console.log(`Fetched source image (${mimeType}, ${(imageBase64.length * 0.75 / 1024).toFixed(0)} KB)`);

  const operationName = await submit(projectId, location, model, accessToken, testCase.prompt, imageBase64, mimeType);
  console.log(`Submitted: ${operationName}`);

  const result = await poll(projectId, location, model, operationName);
  const video = result.response?.videos?.[0];
  if (!video?.bytesBase64Encoded) throw new Error(`No video returned: ${JSON.stringify(result).slice(0, 500)}`);

  const outPath = `poc-output-${caseName}-${Date.now()}.mp4`;
  await fs.writeFile(outPath, Buffer.from(video.bytesBase64Encoded, "base64"));
  console.log(`Saved: ${outPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
