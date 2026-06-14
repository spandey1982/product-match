import { db } from "@/lib/db";
import { getTryOnProvider, DEFAULT_TRYON_PROVIDER_ID } from "./index";
import type { TryOnProvider, TryOnProviderId } from "./types";
import { resolveAutoProvider, type RoutingContext } from "./auto-routing";

/**
 * A retailer's stored try-on mode: a specific provider, or "auto" (let the
 * category router decide). Stored in User.tryOnProvider.
 */
export type TryOnMode = TryOnProviderId | "auto";

export function isTryOnMode(value: unknown): value is TryOnMode {
  return value === "gemini" || value === "vertex" || value === "auto";
}

/**
 * Resolve the active try-on provider for a retailer.
 *
 * Precedence (see docs/IMAGE_AI_ROADMAP.md §5):
 *   automatic routing (mode = "auto")  ▸  admin default (mode = provider)  ▸  Gemini
 *
 * Always returns a usable provider — if the resolved provider isn't enabled in
 * this environment (e.g. Vertex flag off), it falls back to Gemini so a stale
 * selection or unavailable vendor can never break try-on. Never throws.
 *
 * This is the single override point later tasks extend: Task 5 will let a
 * customer choice take precedence above auto-routing — without touching routes.
 */
export async function getActiveTryOnProvider(
  retailerUserId: string,
  context: RoutingContext = {}
): Promise<TryOnProvider> {
  let mode: TryOnMode = DEFAULT_TRYON_PROVIDER_ID;

  try {
    const user = await db.user.findUnique({
      where: { id: retailerUserId },
      select: { tryOnProvider: true },
    });
    if (isTryOnMode(user?.tryOnProvider)) {
      mode = user.tryOnProvider;
    }
  } catch {
    // Lookup failure → keep the default. Try-on must not break on a DB hiccup.
  }

  const chosen: TryOnProviderId =
    mode === "auto" ? resolveAutoProvider(context) : mode;

  if (mode === "auto") {
    console.log(
      `[tryon] auto-routing: category="${context.category ?? "?"}" → ${chosen}`
    );
  }

  const provider = getTryOnProvider(chosen);
  return provider.isEnabled()
    ? provider
    : getTryOnProvider(DEFAULT_TRYON_PROVIDER_ID);
}
