/**
 * Google Veo provider adapter — image-to-video generation.
 *
 * Veo is reachable through two separate Google surfaces that happen to share
 * the same underlying model and the same long-running-operation shape
 * (submit → poll → done), but differ in auth and endpoint:
 *
 *   "vertex"     → aiplatform.googleapis.com, service-account/ADC auth
 *                  (GoogleAuth, GOOGLE_CLOUD_PROJECT) — same account and
 *                  auth pattern as lib/tryon-vertex.ts (Virtual Try-On).
 *   "gemini-api" → generativelanguage.googleapis.com, a plain API key
 *                  (GEMINI_API_KEY) — same account/auth as every other
 *                  Gemini call in this codebase (metadata, GI, image-gen).
 *
 * Which one is used is a single config switch, not a code change:
 * CATALOGUE_MOTION_VEO_AUTH="vertex" (default) or "gemini-api". Everything
 * backend-specific (endpoint URL, auth header, poll mechanics, default
 * model/pricing) is isolated in the VeoBackend implementations below;
 * generateClip() itself doesn't know which one it's talking to.
 *
 * Two hard Veo constraints shape this adapter, confirmed against Google's
 * current docs/pricing (2026-08):
 *   - durationSeconds only accepts 4, 6, or 8 — never an arbitrary value.
 *     Storyboard shots that need AI motion (see types.ts ShotRenderMode) are
 *     rounded UP to the nearest allowed value; the composer trims the extra
 *     seconds later rather than wasting a re-render.
 *   - Billing is per second and non-trivial, which is why only "ai-motion"
 *     shots (the worn-garment front/back views) ever reach this provider;
 *     detail crops and object-only categories render locally via pan-zoom
 *     instead (see lib/catalogue-motion/storyboards.ts).
 * Veo 3.0 is deprecated (Google shut it down 2026-06-30) — never default to
 * it. Each backend defaults to its own cheapest current tier: Vertex has a
 * Lite tier the Gemini API surface doesn't (yet) expose, so the two
 * defaults are genuinely different model ids.
 *
 * ⚠ The Gemini API backend's request/response shape is inferred from the
 * fact that Google documents the SAME :predictLongRunning method name for
 * both surfaces (suggesting a shared envelope) — it has not been confirmed
 * against a live call. Verify on first real use of CATALOGUE_MOTION_VEO_AUTH
 * = "gemini-api" specifically; the Vertex path carries its own separate
 * verification note below.
 */
import { GoogleAuth } from "google-auth-library";
import { estimateCostUsd } from "@/lib/ai-usage/pricing";
import { recordAiUsage } from "@/lib/ai-usage/record";
import type { MotionProvider, ClipRenderInput, ClipRenderResult } from "./types";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 24; // ~2 minutes

/**
 * Veo only accepts 4, 6, or 8 seconds — round up to the nearest allowed
 * value. Exported so a caller building the clip instruction text (e.g. the
 * render worker) can pass the SAME rounded value into buildClipInstruction's
 * "Duration: Ns seconds" line that Veo actually receives as the real
 * durationSeconds parameter — mismatching the two would have the prompt
 * describe a different length than what's actually generated.
 */
export const ALLOWED_DURATIONS = [4, 6, 8] as const;

export function nearestVeoDuration(requestedSec: number): number {
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
  name?: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    videos?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
}

// ── Backend abstraction ─────────────────────────────────────────────────

type VeoAuthMode = "vertex" | "gemini-api";

interface VeoBackend {
  readonly mode: VeoAuthMode;
  readonly defaultModel: string;
  /** Whether this backend's credentials are present. Never throws. */
  isConfigured(): boolean;
  submit(model: string, instructionText: string, imageBase64: string, imageMime: string, durationSeconds: number): Promise<string>;
  poll(model: string, operationName: string): Promise<VeoOperationResponse>;
}

// ── Vertex AI backend (service account / ADC) ───────────────────────────

const VERTEX_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];
let vertexAuth: GoogleAuth | null = null;

function buildVertexAuth(): GoogleAuth {
  const inline = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (inline) {
    let credentials;
    try {
      const json = inline.startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf8");
      credentials = JSON.parse(json);
    } catch {
      throw new Error(
        "Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON (expected raw JSON or base64-encoded JSON)"
      );
    }
    return new GoogleAuth({ credentials, scopes: VERTEX_SCOPES });
  }
  return new GoogleAuth({ scopes: VERTEX_SCOPES });
}

async function getVertexAccessToken(): Promise<string> {
  if (!vertexAuth) vertexAuth = buildVertexAuth();
  const token = await vertexAuth.getAccessToken();
  if (!token) throw new Error("Failed to obtain Google Cloud access token");
  return token;
}

function vertexProjectLocation(): { projectId: string; location: string } | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (!projectId) return null;
  return { projectId, location };
}

const vertexBackend: VeoBackend = {
  mode: "vertex",
  // Lite tier — Vertex-exclusive as of 2026-08, cheapest option on this surface.
  defaultModel: "veo-3.1-lite-generate-001",

  isConfigured(): boolean {
    return vertexProjectLocation() !== null;
  },

  async submit(model, instructionText, imageBase64, imageMime, durationSeconds) {
    const config = vertexProjectLocation();
    if (!config) throw new Error("Vertex is not configured (GOOGLE_CLOUD_PROJECT)");
    const accessToken = await getVertexAccessToken();
    const endpoint =
      `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
      `/locations/${config.location}/publishers/google/models/${model}:predictLongRunning`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(instructionText, imageBase64, imageMime, durationSeconds)),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Veo (vertex) submit error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) throw new Error("Veo (vertex) did not return an operation name");
    return data.name;
  },

  async poll(model, operationName) {
    const config = vertexProjectLocation();
    if (!config) throw new Error("Vertex is not configured (GOOGLE_CLOUD_PROJECT)");
    const accessToken = await getVertexAccessToken();
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
        throw new Error(`Veo (vertex) poll error ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as VeoOperationResponse;
      if (data.error) throw new Error(`Veo (vertex) operation failed: ${data.error.message}`);
      if (data.done) return data;
    }
    throw new Error(`Veo (vertex) operation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms`);
  },
};

// ── Gemini Developer API backend (API key) ──────────────────────────────

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function geminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key-here") return null;
  return key;
}

const geminiApiBackend: VeoBackend = {
  mode: "gemini-api",
  // No confirmed Lite tier on this surface as of 2026-08 — Fast is the
  // cheapest verified option here.
  defaultModel: "veo-3.1-fast-generate-preview",

  isConfigured(): boolean {
    return geminiApiKey() !== null;
  },

  async submit(model, instructionText, imageBase64, imageMime, durationSeconds) {
    const apiKey = geminiApiKey();
    if (!apiKey) throw new Error("Gemini API key is not configured (GEMINI_API_KEY)");
    const endpoint = `${GEMINI_API_BASE}/models/${model}:predictLongRunning`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(instructionText, imageBase64, imageMime, durationSeconds)),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Veo (gemini-api) submit error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) throw new Error("Veo (gemini-api) did not return an operation name");
    return data.name;
  },

  async poll(_model, operationName) {
    const apiKey = geminiApiKey();
    if (!apiKey) throw new Error("Gemini API key is not configured (GEMINI_API_KEY)");
    // The Gemini API surface polls the operation resource directly via GET,
    // unlike Vertex's POST :fetchPredictOperation — operationName here is
    // already the full "models/.../operations/..." resource path returned
    // by submit().
    const endpoint = `${GEMINI_API_BASE}/${operationName}`;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Veo (gemini-api) poll error ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as VeoOperationResponse;
      if (data.error) throw new Error(`Veo (gemini-api) operation failed: ${data.error.message}`);
      if (data.done) return data;
    }
    throw new Error(`Veo (gemini-api) operation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms`);
  },
};

const BACKENDS: Record<VeoAuthMode, VeoBackend> = {
  vertex: vertexBackend,
  "gemini-api": geminiApiBackend,
};

function activeBackend(): VeoBackend {
  const mode = process.env.CATALOGUE_MOTION_VEO_AUTH?.trim().toLowerCase();
  return BACKENDS[mode === "gemini-api" ? "gemini-api" : "vertex"];
}

function veoModel(): string {
  return process.env.CATALOGUE_MOTION_VEO_MODEL || activeBackend().defaultModel;
}

/**
 * Shared request envelope — both surfaces document the same
 * :predictLongRunning method name for Veo, so this assumes (unverified for
 * gemini-api, see the file-level warning) they share the same instances/
 * parameters shape used by every other Vertex predict-style call in this
 * codebase (lib/tryon-vertex.ts).
 */
function buildRequestBody(instructionText: string, imageBase64: string, imageMime: string, durationSeconds: number) {
  return {
    instances: [
      {
        prompt: instructionText,
        image: { bytesBase64Encoded: imageBase64, mimeType: imageMime },
      },
    ],
    parameters: {
      durationSeconds,
      sampleCount: 1,
      // Veo's native aspect ratios are 16:9/9:16, not the 3:4 catalogue card
      // ratio — the composer reframes to 3:4 afterward rather than asking
      // Veo for an unsupported ratio.
      aspectRatio: "9:16",
      resolution: "720p",
      // Catalogue Motion is silent by design (see architecture spec, §Audio).
      generateAudio: false,
    },
  };
}

export const veoMotionProvider: MotionProvider = {
  id: "veo",
  label: "Google Veo",
  maxDurationSec: 10,

  isEnabled(): boolean {
    return process.env.ENABLE_CATALOGUE_MOTION === "true" && activeBackend().isConfigured();
  },

  estimateCost(durationSec: number): number | null {
    return estimateCostUsd(veoModel(), { videoSeconds: nearestVeoDuration(durationSec) });
  },

  async generateClip(input: ClipRenderInput): Promise<ClipRenderResult> {
    const backend = activeBackend();
    if (!this.isEnabled()) {
      throw new Error(
        `Veo catalogue motion is disabled (ENABLE_CATALOGUE_MOTION, or missing credentials for backend "${backend.mode}")`
      );
    }

    const model = veoModel();
    const durationSeconds = nearestVeoDuration(input.durationSec);
    const t0 = Date.now();
    const feature = input.usage?.feature ?? "catalogue_motion";

    try {
      const { data: imageBase64, mimeType: imageMime } = await fetchImageAsBase64(input.sourceImageUrl);
      const operationName = await backend.submit(model, input.instruction.text, imageBase64, imageMime, durationSeconds);
      const result = await backend.poll(model, operationName);
      const durationMs = Date.now() - t0;

      const video = result.response?.videos?.[0] ?? result.response?.predictions?.[0];
      if (!video?.bytesBase64Encoded) {
        // Caught by the outer catch below, which records the error once.
        throw new Error(`Veo (${backend.mode}) operation completed but returned no video`);
      }

      const costUsd = estimateCostUsd(model, { videoSeconds: durationSeconds });
      void recordAiUsage({
        provider: `veo-${backend.mode}`,
        model,
        feature,
        operation: "generate_clip",
        durationMs,
        videoSeconds: durationSeconds,
        storeId: input.usage?.storeId,
        userId: input.usage?.userId,
        productId: input.productId,
        status: "success",
        metadata: {
          requestedDurationSec: input.durationSec,
          veoDurationSeconds: durationSeconds,
          presetId: input.instruction.params.presetId,
          intensity: input.intensity,
        },
      });

      return {
        videoBase64: video.bytesBase64Encoded,
        mimeType: video.mimeType ?? "video/mp4",
        durationMs,
        width: 720,
        height: 1280,
        costUsd,
        provider: "veo",
        model,
      };
    } catch (err) {
      const durationMs = Date.now() - t0;
      void recordAiUsage({
        provider: `veo-${backend.mode}`,
        model,
        feature,
        operation: "generate_clip",
        durationMs,
        storeId: input.usage?.storeId,
        userId: input.usage?.userId,
        productId: input.productId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: { requestedDurationSec: input.durationSec, veoDurationSeconds: durationSeconds },
      });
      throw err;
    }
  },
};
