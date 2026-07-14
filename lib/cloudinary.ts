import { v2 as cloudinary, type UploadApiResponse, type UploadApiOptions } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * True when an upload/API failure is connectivity-shaped (DNS flap, timeout,
 * reset) rather than a bad request — the class of error where retrying later
 * makes sense and the user deserves a "storage temporarily unreachable"
 * message instead of a generic failure. Matches both error shapes the SDK
 * produces: a wrapped Node network error ({ error: Error { code } }) and its
 * own timeout object ({ error: { http_code: 499, name: "TimeoutError" } }).
 */
export function isCloudinaryConnectivityError(err: unknown): boolean {
  const outer = err as
    | { code?: string; name?: string; http_code?: number; error?: { code?: string; name?: string; http_code?: number } }
    | null;
  const e = outer?.error ?? outer;
  const code = e?.code ?? "";
  if (["ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(code)) {
    return true;
  }
  return e?.http_code === 499 || e?.name === "TimeoutError";
}

/**
 * Upload with retry + extended timeout — the standard way to push bytes to
 * Cloudinary anywhere in the app. One retry after a short backoff rides out
 * DNS flaps (which fail in milliseconds, so an immediate retry would land on
 * the same flap), and the 120s timeout covers degraded-API latency that
 * blows the SDK's 60s default (both observed live, 2026-07-14). Throws the
 * last error when every attempt fails — callers decide how to report it.
 */
export async function uploadWithRetry(
  dataUri: string,
  options: UploadApiOptions,
  { attempts = 2, backoffMs = 3000 }: { attempts?: number; backoffMs?: number } = {}
): Promise<UploadApiResponse> {
  const merged: UploadApiOptions = { timeout: 120_000, ...options };
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await cloudinary.uploader.upload(dataUri, merged);
    } catch (err) {
      lastError = err;
      console.error(`[cloudinary] upload attempt ${attempt}/${attempts} failed:`, err);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastError;
}

/**
 * Pre-flight reachability check for Cloudinary's upload/admin API.
 *
 * Generated images can only be delivered if they can be STORED — and the
 * generation call is paid for whether or not the upload afterwards succeeds.
 * Callers run this cheap ping (~100ms when healthy) BEFORE spending on a
 * provider call, turning "pay for a generation, then lose it to a storage
 * outage" into "don't start, tell the retailer, spend nothing" (2026-07-14
 * incident: degraded DNS/latency to api.cloudinary.com timed out every
 * upload while Gemini kept billing).
 *
 * Fails closed on timeout, open on ambiguity: any RESPONSE from the API
 * (even an auth error) proves reachability; only no-response counts as down.
 */
export async function checkCloudinaryReachable(timeoutMs = 6000): Promise<boolean> {
  try {
    await Promise.race([
      cloudinary.api.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("cloudinary ping timeout")), timeoutMs)
      ),
    ]);
    return true;
  } catch (err) {
    const e = err as { error?: { http_code?: number }; http_code?: number };
    const httpCode = e?.error?.http_code ?? e?.http_code;
    // An HTTP status means the API answered — reachable, even if unhappy.
    if (typeof httpCode === "number" && httpCode !== 499) return true;
    console.error("[cloudinary] pre-flight ping failed — treating storage as unreachable:", err);
    return false;
  }
}

export { cloudinary };
