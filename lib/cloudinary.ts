import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
