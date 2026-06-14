import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getTryOnProvider,
  listTryOnProviders,
  DEFAULT_TRYON_PROVIDER_ID,
  type TryOnProviderId,
} from "@/lib/providers";

function isProviderId(value: unknown): value is TryOnProviderId {
  return value === "gemini" || value === "vertex";
}

/** Shape returned to the settings UI: every provider plus whether it's usable. */
function availableProviders() {
  return listTryOnProviders().map((p) => ({
    id: p.id,
    label: p.label,
    enabled: p.isEnabled(),
  }));
}

// GET — current selection + the list of providers (with enabled state)
export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { tryOnProvider: true },
    });
    const provider = isProviderId(user?.tryOnProvider)
      ? user.tryOnProvider
      : DEFAULT_TRYON_PROVIDER_ID;

    return NextResponse.json({ provider, available: availableProviders() });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update this retailer's active try-on provider
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const provider = (body as { provider?: unknown }).provider;

    if (!isProviderId(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'gemini' or 'vertex'." },
        { status: 400 }
      );
    }

    // Don't let an admin select a provider that isn't actually usable here.
    if (!getTryOnProvider(provider).isEnabled()) {
      return NextResponse.json(
        { error: "That provider is not available in this environment." },
        { status: 422 }
      );
    }

    await db.user.update({
      where: { id: session.id },
      data: { tryOnProvider: provider },
    });

    return NextResponse.json({ provider, available: availableProviders() });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
