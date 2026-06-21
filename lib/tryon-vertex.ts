import { readFile } from "fs/promises";
import { join } from "path";
import { GoogleAuth } from "google-auth-library";
import { cloudinary } from "@/lib/cloudinary";
import { getImageDimensions, fmtBytes } from "@/lib/image-utils";
import { recordAiUsage } from "@/lib/ai-usage/record";
import type { TryOnInput, TryOnResult } from "@/lib/tryon";

// ─── Constants ────────────────────────────────────────────────────────────────

const VERTEX_MODEL = "virtual-try-on-001";

// ─── Feature flag / configuration ─────────────────────────────────────────────

/**
 * Master switch for all Vertex AI try-on functionality.
 * Defaults to OFF — production behavior is unchanged until the flag is
 * explicitly set to "true" AND Google Cloud credentials are configured.
 */
export function isVertexTryOnEnabled(): boolean {
  return process.env.ENABLE_VERTEX_TRYON === "true";
}

interface VertexConfig {
  projectId: string;
  location: string;
}

/**
 * Returns the Vertex project/location config, or null when incomplete.
 * Never throws — missing configuration must degrade to a clean 503, not crash.
 */
export function getVertexConfig(): VertexConfig | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  if (!projectId) return null;
  return { projectId, location };
}

// ─── Authentication ───────────────────────────────────────────────────────────

// Lazily initialized so that missing credentials can never break module load
// (and therefore can never affect any other route).
let auth: GoogleAuth | null = null;

const VERTEX_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

/**
 * Build the GoogleAuth client. Credential resolution order:
 *   1. GOOGLE_APPLICATION_CREDENTIALS_JSON — a service-account key supplied
 *      inline as raw JSON or base64-encoded JSON. For hosts that can't mount a
 *      key file (e.g. Railway, Vercel).
 *   2. Default ADC — a GOOGLE_APPLICATION_CREDENTIALS file path, gcloud user
 *      ADC (local), or an attached service account (Cloud Run/GCE).
 *
 * When the inline var is unset, behavior is identical to before (pure ADC).
 * A malformed inline value throws a clear error (caught by the route).
 */
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
    return new GoogleAuth({ credentials, scopes: VERTEX_SCOPES });
  }
  return new GoogleAuth({ scopes: VERTEX_SCOPES });
}

async function getAccessToken(): Promise<string> {
  if (!auth) {
    auth = buildAuth();
  }
  const token = await auth.getAccessToken();
  if (!token) {
    throw new Error("Failed to obtain Google Cloud access token");
  }
  return token;
}

// ─── Vertex response shape ────────────────────────────────────────────────────

interface VertexPredictResponse {
  predictions?: Array<{
    mimeType?: string;
    bytesBase64Encoded?: string;
  }>;
}

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Generates a virtual try-on image using the Vertex AI Virtual Try-On model
 * (virtual-try-on-001, GA).
 *
 * Mirrors the contract of generateTryOn() in lib/tryon.ts: the user's photo
 * and the product image are sent inline (base64) in a single predict request.
 * The user's photo is used only for the duration of the API call and is never
 * written to disk or cloud storage. Only the generated output image is
 * persisted (Cloudinary, product-match/tryon-vertex/).
 *
 * Throws on any failure — callers are responsible for mapping errors to HTTP
 * responses. This module is only reachable from the dedicated tryon-vertex
 * route, which is feature-flagged; failures here cannot affect the existing
 * Gemini try-on flow.
 */
export async function generateTryOnVertex(input: TryOnInput): Promise<TryOnResult> {
  if (!isVertexTryOnEnabled()) {
    throw new Error("Vertex try-on is disabled (ENABLE_VERTEX_TRYON)");
  }

  const config = getVertexConfig();
  if (!config) {
    throw new Error("Vertex try-on is not configured (GOOGLE_CLOUD_PROJECT)");
  }

  const {
    productImageUrl,
    userPhotoBuffer,
    userPhotoMimeType,
    productCategory,
    productColor,
    productId,
    productTitle = productId,
    userId = "unknown",
  } = input;

  // ── Fetch product image — mirrors lib/tryon.ts strategy ─────────────────
  let productBuffer: Buffer;
  let productMimeHint = "image/jpeg";

  if (productImageUrl.startsWith("http")) {
    const productRes = await fetch(productImageUrl);
    if (!productRes.ok) {
      throw new Error(
        `Failed to fetch product image (HTTP ${productRes.status})`
      );
    }
    productMimeHint = productRes.headers.get("content-type") ?? "image/jpeg";
    productBuffer = Buffer.from(await productRes.arrayBuffer());
  } else if (productImageUrl.startsWith("/uploads/")) {
    const localPath = join(process.cwd(), "public", productImageUrl);
    try {
      productBuffer = await readFile(localPath);
    } catch {
      throw new Error(`Product image file not found: ${localPath}`);
    }
  } else {
    throw new Error(`Unsupported product image URL format: ${productImageUrl}`);
  }

  const ext = productImageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const productMime = mimeMap[ext] ?? productMimeHint;

  // ── Log input image metadata ─────────────────────────────────────────────
  const userDims = getImageDimensions(userPhotoBuffer, userPhotoMimeType);
  const productDims = getImageDimensions(productBuffer, productMime);

  console.log(`[tryon-vertex] ── Input images ──────────────────────────────`);
  console.log(`[tryon-vertex] User photo   : ${fmtBytes(userPhotoBuffer.length)}  mime=${userPhotoMimeType}  ${userDims ? `${userDims.width}×${userDims.height}px` : "dims=unknown"}`);
  console.log(`[tryon-vertex] Product image: ${fmtBytes(productBuffer.length)}  mime=${productMime}  ${productDims ? `${productDims.width}×${productDims.height}px` : "dims=unknown"}`);
  console.log(`[tryon-vertex] Product: ${productTitle} (${productCategory} · ${productColor})`);
  console.log(`[tryon-vertex] Calling Vertex model: ${VERTEX_MODEL} (${config.location})`);

  // ── Build request ────────────────────────────────────────────────────────
  // Vertex VTO takes images only — no text prompt is supported by the model.
  const accessToken = await getAccessToken();
  const endpoint =
    `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
    `/locations/${config.location}/publishers/google/models/${VERTEX_MODEL}:predict`;

  const t0 = Date.now();

  const vertexRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [
        {
          personImage: {
            image: { bytesBase64Encoded: userPhotoBuffer.toString("base64") },
          },
          productImages: [
            {
              image: { bytesBase64Encoded: productBuffer.toString("base64") },
            },
          ],
        },
      ],
      parameters: {
        sampleCount: 1,
      },
    }),
  });

  const generationMs = Date.now() - t0;
  console.log(`[tryon-vertex] Vertex responded: ${vertexRes.status}  (${generationMs} ms)`);

  const feature = input.usage?.feature ?? "tryon";
  const storeId = input.usage?.storeId ?? null;
  const usageUserId = input.usage?.userId ?? (userId === "unknown" ? null : userId);
  const requestBytes = userPhotoBuffer.length + productBuffer.length;

  if (!vertexRes.ok) {
    const body = await vertexRes.text();
    void recordAiUsage({
      provider: "vertex",
      model: VERTEX_MODEL,
      feature,
      operation: "tryon",
      durationMs: generationMs,
      requestBytes,
      imageInputs: 2,
      storeId,
      userId: usageUserId,
      productId,
      status: "error",
      errorMessage: `HTTP ${vertexRes.status}: ${body.slice(0, 300)}`,
    });
    throw new Error(
      `Vertex AI error ${vertexRes.status}: ${body.slice(0, 300)}`
    );
  }

  // ── Parse response ───────────────────────────────────────────────────────
  const data = (await vertexRes.json()) as VertexPredictResponse;
  const prediction = data.predictions?.find((p) => p.bytesBase64Encoded);

  if (!prediction?.bytesBase64Encoded) {
    void recordAiUsage({
      provider: "vertex",
      model: VERTEX_MODEL,
      feature,
      operation: "tryon",
      durationMs: generationMs,
      requestBytes,
      imageInputs: 2,
      storeId,
      userId: usageUserId,
      productId,
      status: "error",
      errorMessage: "No image returned by Vertex AI Virtual Try-On",
    });
    throw new Error("No image returned by Vertex AI Virtual Try-On");
  }

  // ── Log output image metadata ────────────────────────────────────────────
  const outMime = prediction.mimeType ?? "image/png";
  const outBuffer = Buffer.from(prediction.bytesBase64Encoded, "base64");
  const outDims = getImageDimensions(outBuffer, outMime);

  console.log(`[tryon-vertex] ── Output image ─────────────────────────────`);
  console.log(`[tryon-vertex] Size: ${fmtBytes(outBuffer.length)}  mime=${outMime}  ${outDims ? `${outDims.width}×${outDims.height}px` : "dims=unknown"}`);

  // ── Upload result to Cloudinary ──────────────────────────────────────────
  const dataUri = `data:${outMime};base64,${prediction.bytesBase64Encoded}`;

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "product-match/tryon-vertex",
    tags: [
      `product:${productId}`,
      `category:${productCategory}`,
      `color:${productColor}`,
      `user:${userId}`,
      "provider:vertex",
    ],
    context: {
      product_id:    productId,
      product_title: productTitle,
      category:      productCategory,
      color:         productColor,
      provider:      "vertex",
      generated_at:  new Date().toISOString(),
    },
  });

  console.log(`[tryon-vertex] Uploaded to Cloudinary: ${uploaded.secure_url}`);

  // ── Record AI usage (cost ledger) ────────────────────────────────────────
  // Vertex VTO bills per generated image and reports no tokens.
  void recordAiUsage({
    provider: "vertex",
    model: VERTEX_MODEL,
    feature,
    operation: "tryon",
    imagesGenerated: 1,
    imageInputs: 2,
    requestBytes,
    responseBytes: outBuffer.length,
    durationMs: generationMs,
    storeId,
    userId: usageUserId,
    productId,
    status: "success",
    metadata: {
      outputUrl: uploaded.secure_url,
      category: productCategory,
      color: productColor,
      inputImages: [
        { label: "user-photo", mime: userPhotoMimeType, sizeBytes: userPhotoBuffer.length, widthPx: userDims?.width ?? null, heightPx: userDims?.height ?? null },
        { label: "product-image", mime: productMime, sizeBytes: productBuffer.length, widthPx: productDims?.width ?? null, heightPx: productDims?.height ?? null },
      ],
      outputImage: { mime: outMime, sizeBytes: outBuffer.length, widthPx: outDims?.width ?? null, heightPx: outDims?.height ?? null },
    },
  });

  return { url: uploaded.secure_url };
}
