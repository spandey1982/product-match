import { cookies } from "next/headers";

const GUEST_DEVICE_COOKIE = "pm_guest_device";
const GUEST_DEVICE_COOKIE_DURATION = 60 * 60 * 24 * 365; // 1 year

/**
 * Anonymous device id for the pre-login /shop try-on quota (see
 * GuestTryOnUsage) — not verified identity, just a repeat-visit signal.
 * Read-only, safe to call during a Server Component render — Next.js
 * forbids setting cookies outside a Route Handler/Server Action, so this
 * never creates one. Use getOrCreateGuestDeviceId for that.
 */
export async function peekGuestDeviceId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_DEVICE_COOKIE)?.value ?? null;
}

/**
 * Same as peekGuestDeviceId, but mints and sets a new cookie when none
 * exists. Only callable from a Route Handler (the tryon route) — calling
 * this during a page render throws.
 */
export async function getOrCreateGuestDeviceId(): Promise<{ id: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_DEVICE_COOKIE)?.value;
  if (existing) return { id: existing, isNew: false };

  const id = crypto.randomUUID();
  cookieStore.set(GUEST_DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GUEST_DEVICE_COOKIE_DURATION,
    path: "/",
  });
  return { id, isNew: true };
}
