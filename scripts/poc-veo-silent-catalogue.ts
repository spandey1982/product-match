/**
 * POC — silent multi-section catalogue video using the SAME Veo 3.1
 * "full natural performance" prompting style validated in
 * poc-veo-presenter-dialogue.ts, but with no dialogue/lip-sync at all.
 *
 * Idea: the presenter-reel spike discovered that Veo produces dramatically
 * better garment fidelity + natural human motion when prompted for a
 * genuine performance (expression, subtle natural movement) than when
 * prompted for pure camera motion only (the existing lib/catalogue-motion/
 * reel/ engine's approach, which explicitly bans expression/gesture change
 * — see UNIVERSAL_CONSTRAINTS). This script tests whether that same
 * performance-style prompting, stripped of speech, produces a better
 * *silent* catalogue video (marketing by showing, not speaking) than the
 * existing camera-motion-only method — the original goal of this branch.
 *
 * Produces one short silent clip per "section" of the product (front, a
 * detail crop, back), from the SAME two primary generated photos already in
 * the catalogue, then concatenates them into one video. Also runs one
 * side-by-side comparison: the same front-section prompt with three "old"
 * cinematography features added (camera movement, material-matched
 * lighting, depth-of-field), reusing the exact language already established
 * in lib/catalogue-motion/grammar.ts, lib/catalogue-motion/reel/lighting.ts,
 * and lib/catalogue-motion/reel/reel-prompt-builder.ts's DEPTH_OF_FIELD_LINE
 * — added ONLY if it doesn't visibly change/degrade the result versus the
 * plain baseline, per the instruction that this new method is the priority.
 *
 * NOT wired into the app. Standalone. Does not import from or modify any
 * existing catalogue-motion code — the existing image-to-video reel engine
 * stays untouched; this calls the same Vertex endpoints directly.
 *
 * Usage:
 *   npx tsx scripts/poc-veo-silent-catalogue.ts <section>
 *   npx tsx scripts/poc-veo-silent-catalogue.ts front
 *   npx tsx scripts/poc-veo-silent-catalogue.ts detail
 *   npx tsx scripts/poc-veo-silent-catalogue.ts back
 *   npx tsx scripts/poc-veo-silent-catalogue.ts front-enhanced   (comparison run)
 *
 * Then concatenate whichever set won the comparison:
 *   ffmpeg -f concat -safe 0 -i <list.txt> -c copy poc-catalogue-final.mp4
 *
 * Each run costs real money on the Google Cloud billing account tied to
 * GOOGLE_CLOUD_PROJECT — Standard-tier Veo 3.1 billed per second (~$0.40/sec
 * observed); every run here requests 6s, so budget ~$2.40 per invocation.
 */
import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import fs from "node:fs/promises";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 36;

// ── Product under test: Mint Green Embroidered Lehenga Set ──────────────
// (product id cmtbhjqri0002aslbf17t0z81 — fresh, not used in any prior test
// this session; Lehenga category, dense mirror-work + embroidery throughout,
// a genuinely harder case than plain camera-motion catalogue clips usually
// attempt on this product type)

const FRONT_URL = "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1787832979/product-match/catalogue/s7awhdgp0ojz2b9pnpcb.jpg";
const BACK_URL = "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1787833023/product-match/catalogue/ooevz4v975khrhfi2agv.jpg";
// Same bodice crop region already defined for this product's "choli-front"
// reel shot (c_crop w=0.6 h=0.5973 x=0.2 y=0), branding layers stripped.
const DETAIL_URL =
  "https://res.cloudinary.com/dxmpq4xnk/image/upload/c_crop,w_0.6,h_0.5973333333333334,x_0.2,y_0/c_scale,w_1200,h_1600/v1787832979/product-match/catalogue/s7awhdgp0ojz2b9pnpcb.jpg";

// ── "Old feature" language, reused verbatim from the existing reel engine ─
// (not invented for this test — see grammar.ts, reel/lighting.ts, reel-prompt-builder.ts)

const SLOW_PUSH_IN = "Gradual forward dolly toward the subject center"; // grammar.ts MOTION_PRESETS["slow-push-in"].description
const EMBROIDERY_LIGHTING = "a raking side-light angled to catch metallic thread and embroidery texture without harsh glare"; // lighting.ts, matches /embroider/i
const DEPTH_OF_FIELD_LINE =
  " The subject stays tack sharp for the full shot; the space behind it " +
  "falls into soft, shallow depth-of-field blur — a subtle focus falloff " +
  "on the background already visible in the source photo, not a new or " +
  "added effect."; // reel-prompt-builder.ts DEPTH_OF_FIELD_LINE, verbatim

// ── The four test cases ──────────────────────────────────────────────────

interface TestCase {
  label: string;
  imageUrl: string;
  prompt: string;
}

const NO_SPEECH_CLAUSE = "She does not speak — this is a silent shot."; // exists to explicitly suppress Veo inventing dialogue/mouth movement

const TEST_CASES: Record<string, TestCase> = {
  front: {
    label: "FRONT (full lehenga + dupatta)",
    imageUrl: FRONT_URL,
    prompt:
      "The woman in the photo stands in place with a warm, natural smile, as if posing for a fashion photoshoot. " +
      NO_SPEECH_CLAUSE +
      " She subtly shifts her weight and gently adjusts the embroidered dupatta draped over her shoulder with one hand, " +
      "causing the lehenga skirt and dupatta fabric to sway naturally. " +
      "Her pose, the lehenga, its embroidery and mirror-work, the background, and the lighting stay exactly as in the photo — " +
      "only her expression, subtle body movement, and hand move naturally.",
  },
  detail: {
    label: "DETAIL (mirror-work bodice crop)",
    imageUrl: DETAIL_URL,
    prompt:
      "The woman in the photo holds a gentle, pleasant expression, as if posing for a close-up fashion photograph. " +
      NO_SPEECH_CLAUSE +
      " She subtly shifts her head and shoulders, and her fingers lightly adjust the embroidered dupatta at her shoulder, " +
      "causing a small natural fabric movement. " +
      "Her pose, the blouse's mirror-work embroidery, the background, and the lighting stay exactly as in the photo — " +
      "only her expression and this small natural movement change.",
  },
  back: {
    label: "BACK (open-back blouse + dupatta drape)",
    imageUrl: BACK_URL,
    prompt:
      "The woman in the photo stands with her back to the camera in a relaxed, natural stance, as if posing for a fashion photoshoot. " +
      NO_SPEECH_CLAUSE +
      " She gently tilts her head and shifts her weight, and her raised hand subtly adjusts the dupatta fabric she is holding, " +
      "causing the dupatta and skirt to sway naturally. " +
      "Her pose, the lehenga, its embroidery and mirror-work, the background, and the lighting stay exactly as in the photo — " +
      "only her subtle body movement and hand change.",
  },
  // Comparison run: the exact same FRONT prompt and image as above, with
  // three "old" cinematography features layered on top. Compare the output
  // against `front` above — keep this version only if it looks at least as
  // good; otherwise the plain `front` version wins and ships in the final
  // concatenated video.
  "front-enhanced": {
    label: "FRONT + old features (camera move, lighting, DOF) — comparison run",
    imageUrl: FRONT_URL,
    prompt:
      "The woman in the photo stands in place with a warm, natural smile, as if posing for a fashion photoshoot. " +
      NO_SPEECH_CLAUSE +
      " She subtly shifts her weight and gently adjusts the embroidered dupatta draped over her shoulder with one hand, " +
      "causing the lehenga skirt and dupatta fabric to sway naturally. " +
      `Camera: ${SLOW_PUSH_IN.toLowerCase()}. ` +
      `Lighting: ${EMBROIDERY_LIGHTING}.` +
      DEPTH_OF_FIELD_LINE +
      " Her pose, the lehenga, its embroidery and mirror-work stay exactly as in the photo — " +
      "only her expression, subtle body movement, hand, and the described camera/lighting change.",
  },
};

// ── Vertex plumbing — identical pattern to poc-veo-presenter-dialogue.ts ──

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
      durationSeconds: 6, // within the requested 4-6s range
      sampleCount: 1,
      aspectRatio: "9:16",
      resolution: "720p",
      generateAudio: false, // <- the key difference from poc-veo-presenter-dialogue.ts: silent, no dialogue
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
    console.error(`Usage: npx tsx scripts/poc-veo-silent-catalogue.ts <${Object.keys(TEST_CASES).join("|")}>`);
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

  const outPath = `poc-catalogue-${caseName}-${Date.now()}.mp4`;
  await fs.writeFile(outPath, Buffer.from(video.bytesBase64Encoded, "base64"));
  console.log(`Saved: ${outPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
