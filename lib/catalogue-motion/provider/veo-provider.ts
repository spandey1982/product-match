/**
 * Google Veo provider adapter — image-to-video generation via Vertex AI.
 *
 * Mirrors the auth/config pattern of lib/tryon-vertex.ts (GoogleAuth + ADC,
 * same GOOGLE_CLOUD_PROJECT/GOOGLE_CLOUD_LOCATION env vars), but gated by its
 * own flag: catalogue motion is a distinct feature from try-on, not a shared
 * on/off switch, even though both currently run on the same GCP project.
 *
 * Veo generation is a long-running operation (submit → poll → done), unlike
 * the synchronous predict calls used elsewhere in this codebase. This adapter
 * submits via :predictLongRunning and polls :fetchPredictOperation until the
 * video is ready or the timeout is hit.
 *
 * ⚠ VERIFY the request/response shape against the live Vertex AI Veo API
 * reference before the first real call — this was built from documented
 * conventions, not a live test. Veo API access may also require separate
 * allowlisting on the GCP project beyond what Vertex Virtual Try-On needs.
 */
import { GoogleAuth } from "google-auth-library";
import type { MotionProvider, ClipRenderInput, ClipRenderResult } from "./types";

const DEFAULT_VEO_MODEL = "veo-3.0-generate-preview";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 24; // ~2 minutes

function veoModel(): string {
  return process.env.CATALOGUE_MOTION_VEO_MODEL || DEFAULT_VEO_MODEL;
}

interface VeoConfig {
  projectId: string;
  location: string;
}

function getVeoConfig(): VeoConfig | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (!projectId) return null;
  return { projectId, location };
}

const VEO_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];
let auth: GoogleAuth | null = null;

function buildAuth(): GoogleAuth {
  const inline = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (inline) {
    let credentials;
    try {
      const json = inline.startsWith("{")
        ? inline
        : Buffer.from(inline, "base64").toString("utf8");
      credentials = JSON.parse(json);
    } catch {
      throw new Error(
        "Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON (expected raw JSON or base64-encoded JSON)"
      );
    }
    return new GoogleAuth({ credentials, scopes: VEO_SCOPES });
  }
  return new GoogleAuth({ scopes: VEO_SCOPES });
}

async function getAccessToken(): Promise<string> {
  if (!auth) auth = buildAuth();
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface VeoOperationResponse {
  name?: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    videos?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
}

async function submitGeneration(
  config: VeoConfig,
  accessToken: string,
  input: ClipRenderInput,
): Promise<string> {
  const { data: imageBase64, mimeType: imageMime } = await fetchImageAsBase64(input.sourceImageUrl);
  const model = veoModel();
  const endpoint =
    `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
    `/locations/${config.location}/publishers/google/models/${model}:predictLongRunning`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [
        {
          prompt: input.instruction.text,
          image: { bytesBase64Encoded: imageBase64, mimeType: imageMime },
        },
      ],
      parameters: {
        durationSeconds: input.durationSec,
        sampleCount: 1,
        aspectRatio: "3:4",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Veo submit error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("Veo did not return an operation name");
  return data.name;
}

async function pollOperation(
  config: VeoConfig,
  accessToken: string,
  operationName: string,
): Promise<VeoOperationResponse> {
  const model = veoModel();
  const endpoint =
    `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
    `/locations/${config.location}/publishers/google/models/${model}:fetchPredictOperation`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ operationName }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Veo poll error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as VeoOperationResponse;
    if (data.error) throw new Error(`Veo operation failed: ${data.error.message}`);
    if (data.done) return data;
  }

  throw new Error(`Veo operation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms`);
}

export const veoMotionProvider: MotionProvider = {
  id: "veo",
  label: "Google Veo",
  maxDurationSec: 10,

  isEnabled(): boolean {
    return process.env.ENABLE_CATALOGUE_MOTION === "true" && getVeoConfig() !== null;
  },

  estimateCost(): number | null {
    // No verified per-second/per-clip rate yet — never fabricate a price
    // (same convention as lib/ai-usage/pricing.ts). Add an entry there once
    // live Veo pricing is confirmed, and wire it in here.
    return null;
  },

  async generateClip(input: ClipRenderInput): Promise<ClipRenderResult> {
    if (!this.isEnabled()) {
      throw new Error("Veo catalogue motion is disabled (ENABLE_CATALOGUE_MOTION or GOOGLE_CLOUD_PROJECT)");
    }
    const config = getVeoConfig();
    if (!config) throw new Error("Veo is not configured (GOOGLE_CLOUD_PROJECT)");

    const accessToken = await getAccessToken();
    const t0 = Date.now();

    const operationName = await submitGeneration(config, accessToken, input);
    const result = await pollOperation(config, accessToken, operationName);

    const video = result.response?.videos?.[0] ?? result.response?.predictions?.[0];
    if (!video?.bytesBase64Encoded) {
      throw new Error("Veo operation completed but returned no video");
    }

    return {
      videoBase64: video.bytesBase64Encoded,
      mimeType: video.mimeType ?? "video/mp4",
      durationMs: Date.now() - t0,
      width: 1080,
      height: 1440,
      costUsd: null,
      provider: "veo",
      model: veoModel(),
    };
  },
};
