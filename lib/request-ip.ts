import { NextRequest } from "next/server";

/**
 * Best-effort client IP from the standard forwarding header (Railway and
 * most proxies set this) — not authoritative, spoofable by the client
 * itself when there's no trusted proxy in front, and shared across everyone
 * on the same network. Only used as a coarse abuse-deterrence signal (see
 * lib/shop/guest-device.ts), never for anything security-sensitive.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
