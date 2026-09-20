/**
 * Google Veo provider adapter for the AI Presenter Reel — audio-driven
 * dialogue generation, not image-to-video camera motion.
 *
 * This is the M1 promotion of the M0 validation spike's throwaway scripts
 * (scripts/poc-veo-presenter-dialogue.ts) into a real, reusable module.
 * Confirmed 3-for-3 on distinct products (solid suit, embroidered saree ×2,
 * dense all-over sherwani) with zero garment-fidelity failures before this
 * file existed — see research/ai-presenter-reel-reverse-engineering.html
 * and the ad-reel-direction memory for the full validation trail.
 *
 * Deliberately does NOT import from, extend, or modify
 * lib/catalogue-motion/provider/veo-provider.ts, even though both call the
 * same Vertex API — per the instruction that started this module ("leave
 * the image-to-video architecture as it is, build this parallelly as a
 * separate module"). The auth/endpoint pattern below is intentionally
 * duplicated, not shared, so a future change to one module's Veo
 * integration (e.g. a new safety-setting default) never silently changes
 * the other's behavior.
 *
 * Two things make this a genuinely different call than the catalogue-motion
 * provider's, not just a copy:
 *   - generateAudio: true (that file hardcodes false — Catalogue Motion is
 *     silent by design). This is what makes lip-synced dialogue possible.
 *   - Standard-tier model (veo-3.1-generate-001), not Lite
 *     (veo-3.1-lite-generate-001) — Lite does not support audio.
 * There is no separate TTS/voice-synthesis step: Veo generates the voice,
 * the lip-sync, and the gesture timing all from the same prompt in one
 * call — confirmed empirically during the M0 spike, not assumed from docs.
 */
import { GoogleAuth } from "google-auth-library";
import { estimateCostUsd } from "@/lib/ai-usage/pricing";
import { recordAiUsage } from "@/lib/ai-usage/record";
import type { PresenterProvider, PresenterRenderInput, PresenterRenderResult } from "./types";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 36; // ~3 minutes — matches the M0 spike scripts' observed 7-9 poll completion time with headroom

const MODEL = "veo-3.1-generate-001";

/** Veo only accepts 4, 6, or 8 seconds — same constraint as catalogue-motion's ALLOWED_DURATIONS, duplicated rather than imported (see file header). */
export const ALLOWED_DURATIONS = [4, 6, 8] as const;

export function nearestPresenterDuration(requestedSec: number): number {
  return ALLOWED_DURATIONS.find((d) => d >= requestedSec) ?? ALLOWED_DURATIONS[ALLOWED_DURATIONS.length - 1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source image (HTTP ${res.status})`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { data, mimeType };
}

interface VeoOperationResponse {
  done?: boolean;
  error?: { code: number; message: string };
  response?: { videos?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
}

let cachedAuth: GoogleAuth | null = null;

async function getAccessToken(): Promise<string> {
  if (!cachedAuth) cachedAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await cachedAuth.getAccessToken();
  if (!token) throw new Error("Failed to obtain Google Cloud access token");
  return token;
}

function vertexConfig(): { projectId: string; location: string } | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (!projectId) return null;
  return { projectId, location };
}

/**
 * Builds the presenter script into a dialogue-carrying Veo prompt. Kept as
 * one paragraph, not separate "camera"/"lighting" clauses — the M0 spike's
 * front-enhanced comparison run found Veo deprioritizes competing
 * cinematography instructions when layered onto a performance instruction
 * (no visible difference from the plain version), so this deliberately
 * stays a single natural-language performance description: identity/pose
 * lock, the spoken line, a gesture cue, done.
 */
function buildPresenterPrompt(script: string): string {
  return (
    "The person in the photo stands in place and speaks directly to camera with natural lip-sync, " +
    `saying in a warm, natural voice: "${script}" ` +
    "While speaking, they gesture naturally with their hands, as a real presenter would. " +
    "Their pose, the garment, the background, and the lighting stay exactly as in the photo — " +
    "only their face, mouth, and hands move naturally as they talk."
  );
}

async function submit(
  config: { projectId: string; location: string },
  accessToken: string,
  prompt: string,
  imageBase64: string,
  imageMime: string,
  durationSeconds: number
): Promise<string> {
  const endpoint =
    `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
    `/locations/${config.location}/publishers/google/models/${MODEL}:predictLongRunning`;

  const body = {
    instances: [{ prompt, image: { bytesBase64Encoded: imageBase64, mimeType: imageMime } }],
    parameters: {
      durationSeconds,
      sampleCount: 1,
      aspectRatio: "9:16",
      resolution: "720p",
      generateAudio: true,
      personGeneration: "allow_adult",
      safetySetting: "block_only_high",
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veo presenter submit error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("Veo presenter did not return an operation name");
  return data.name;
}

async function poll(config: { projectId: string; location: string }, operationName: string): Promise<VeoOperationResponse> {
  const endpoint =
    `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
    `/locations/${config.location}/publishers/google/models/${MODEL}:fetchPredictOperation`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const accessToken = await getAccessToken();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ operationName }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Veo presenter poll error ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as VeoOperationResponse;
    if (data.error) throw new Error(`Veo presenter operation failed: ${data.error.message}`);
    if (data.done) return data;
  }
  throw new Error(`Veo presenter operation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms`);
}

export const veoPresenterProvider: PresenterProvider = {
  id: "veo",
  label: "Google Veo (dialogue)",
  maxDurationSec: 8,

  isEnabled(): boolean {
    return vertexConfig() !== null;
  },

  estimateCost(durationSec: number): number | null {
    return estimateCostUsd(MODEL, { videoSeconds: nearestPresenterDuration(durationSec) });
  },

  async generateClip(input: PresenterRenderInput): Promise<PresenterRenderResult> {
    const config = vertexConfig();
    if (!config) throw new Error("Veo presenter provider is not configured (GOOGLE_CLOUD_PROJECT)");

    const durationSeconds = nearestPresenterDuration(input.durationSec);
    const prompt = buildPresenterPrompt(input.script);
    const t0 = Date.now();
    const feature = input.usage?.feature ?? "presenter_reel";

    try {
      const accessToken = await getAccessToken();
      const { data: imageBase64, mimeType: imageMime } = await fetchImageAsBase64(input.sourceImageUrl);
      const operationName = await submit(config, accessToken, prompt, imageBase64, imageMime, durationSeconds);
      const result = await poll(config, operationName);
      const durationMs = Date.now() - t0;

      const video = result.response?.videos?.[0];
      if (!video?.bytesBase64Encoded) {
        throw new Error("Veo presenter operation completed but returned no video");
      }

      const costUsd = estimateCostUsd(MODEL, { videoSeconds: durationSeconds });
      void recordAiUsage({
        provider: "veo-presenter",
        model: MODEL,
        feature,
        operation: "generate_clip",
        durationMs,
        videoSeconds: durationSeconds,
        storeId: input.usage?.storeId,
        userId: input.usage?.userId,
        productId: input.productId,
        status: "success",
        metadata: { requestedDurationSec: input.durationSec, veoDurationSeconds: durationSeconds },
      });

      return {
        videoBase64: video.bytesBase64Encoded,
        mimeType: video.mimeType ?? "video/mp4",
        durationMs,
        width: 720,
        height: 1280,
        costUsd,
        provider: "veo",
        model: MODEL,
      };
    } catch (err) {
      const durationMs = Date.now() - t0;
      void recordAiUsage({
        provider: "veo-presenter",
        model: MODEL,
        feature,
        operation: "generate_clip",
        durationMs,
        storeId: input.usage?.storeId,
        userId: input.usage?.userId,
        productId: input.productId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: { requestedDurationSec: input.durationSec },
      });
      throw err;
    }
  },
};
