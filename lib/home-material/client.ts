/**
 * Client-safe helpers for Home Material UI components — no server-only
 * imports, safe from "use client" files.
 */

/**
 * Reads a fetch Response as JSON without blindly trusting the body IS
 * JSON. A route handler always returns JSON, but anything in front of it
 * (a platform body-size limit, a proxy's own error page, a crashed cold
 * start) can return something else — and `res.json()` throwing on that
 * used to fall through to a generic "Something went wrong" with zero
 * diagnostic value. This always resolves to an object with at least an
 * `error` string when parsing fails, carrying the real HTTP status and a
 * snippet of the actual body so the failure is diagnosable instead of
 * opaque.
 */
export async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return { error: `Empty response (HTTP ${res.status})` };
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Unexpected response (HTTP ${res.status}): ${text.slice(0, 200)}` };
  }
}
