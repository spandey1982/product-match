import { db } from "@/lib/db";
import { getTryOnProvider, DEFAULT_TRYON_PROVIDER_ID } from "./index";
import type { TryOnProvider, TryOnProviderId } from "./types";

function isProviderId(value: unknown): value is TryOnProviderId {
  return value === "gemini" || value === "vertex";
}

/**
 * Resolve the active try-on provider for a retailer (admin selection, Task 3).
 *
 * Reads the retailer's stored choice (User.tryOnProvider, default "gemini").
 * Always returns a usable provider — if the stored choice is missing, invalid,
 * or currently disabled, it falls back to the system default (Gemini) so a
 * stale selection can never break try-on. Never throws.
 *
 * This is the single override point that later tasks extend: Task 4 inserts
 * automatic (category-based) routing here; Task 5 lets a customer choice take
 * precedence — without touching routes again.
 */
export async function getActiveTryOnProvider(
  retailerUserId: string
): Promise<TryOnProvider> {
  let chosen: TryOnProviderId = DEFAULT_TRYON_PROVIDER_ID;

  try {
    const user = await db.user.findUnique({
      where: { id: retailerUserId },
      select: { tryOnProvider: true },
    });
    if (isProviderId(user?.tryOnProvider)) {
      chosen = user.tryOnProvider;
    }
  } catch {
    // Lookup failure → keep the default. Try-on must not break on a DB hiccup.
  }

  const provider = getTryOnProvider(chosen);
  return provider.isEnabled()
    ? provider
    : getTryOnProvider(DEFAULT_TRYON_PROVIDER_ID);
}
