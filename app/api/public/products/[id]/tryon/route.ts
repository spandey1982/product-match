import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { getOrCreateGuestDeviceId, peekGuestDeviceId } from "@/lib/shop/guest-device";
import { getClientIp } from "@/lib/request-ip";
import { db } from "@/lib/db";
import {
  TRYON_ALLOWED_MIME_TYPES,
  type TryOnMimeType,
  detectImageMimeFromBytes,
  createRateLimiter,
} from "@/lib/tryon";
import { getActiveTryOnProvider } from "@/lib/providers/active";
import { normalizeTryOnUrl } from "@/lib/image-normalize";
import { SIGN_IN_FOR_CREDITS_MESSAGE, INSUFFICIENT_CREDITS_MESSAGE, FREE_TRYON_CREDITS } from "@/lib/vto-credits/packages";

// Separate instance from the rental/retailer routes' limiters — a shop
// shopper's quota is independent of either. Shared by both logged-in
// customers (keyed by customer id) and guests (keyed by device id).
const consumeRateLimit = createRateLimiter(5, 10 * 60 * 1000); // 5 per 10 min

// Coarse deterrent against spinning up fresh guest identities to dodge the
// per-device quota (e.g. clearing cookies repeatedly) — not a security
// boundary, just raises the bar. Only checked when actually minting a new
// device id, never for an existing one.
const consumeGuestDeviceCreation = createRateLimiter(3, 24 * 60 * 60 * 1000); // 3 new guest ids per IP per day

const ALLOWED_MIME_SET = new Set<string>(TRYON_ALLOWED_MIME_TYPES);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

type Identity =
  | { kind: "customer"; rateLimitKey: string; customerId: string }
  | { kind: "guest"; rateLimitKey: string; deviceId: string };

/**
 * Resolves who's asking and how many free try-ons they have left, without
 * touching generation. A logged-in customer uses Customer.tryOnCredits
 * (unchanged). A guest gets their own pool (GuestTryOnUsage, 5 free — same
 * number as FREE_TRYON_CREDITS, a separate pool) tracked via an anonymous
 * device cookie (lib/shop/guest-device.ts) so they can try things on before
 * ever signing up; once spent, SIGN_IN_FOR_CREDITS_MESSAGE nudges them to
 * log in for 5 more. Returns a ready-to-send `response` instead of an
 * `identity` when the caller is out of credits or blocked by the
 * guest-identity creation throttle.
 */
async function resolveIdentity(req: NextRequest): Promise<
  { identity: Identity; creditsBefore: number } | { response: NextResponse }
> {
  const session = await getCustomerSession();

  if (session) {
    const customer = await db.customer.findUnique({
      where: { id: session.id },
      select: { tryOnCredits: true },
    });

    if (!customer || customer.tryOnCredits <= 0) {
      return { response: NextResponse.json({ error: INSUFFICIENT_CREDITS_MESSAGE }, { status: 402 }) };
    }

    return {
      identity: { kind: "customer", rateLimitKey: session.id, customerId: session.id },
      creditsBefore: customer.tryOnCredits,
    };
  }

  const existingDeviceId = await peekGuestDeviceId();
  if (!existingDeviceId && !consumeGuestDeviceCreation(getClientIp(req))) {
    return {
      response: NextResponse.json(
        { error: "Too many guest try-on sessions from this network. Please sign in to continue." },
        { status: 429 }
      ),
    };
  }

  const { id: deviceId } = await getOrCreateGuestDeviceId();
  const usage = await db.guestTryOnUsage.upsert({
    where: { deviceId },
    update: {},
    create: { deviceId, ipAddress: getClientIp(req) },
  });

  if (usage.usedCount >= FREE_TRYON_CREDITS) {
    return { response: NextResponse.json({ error: SIGN_IN_FOR_CREDITS_MESSAGE }, { status: 401 }) };
  }

  return {
    identity: { kind: "guest", rateLimitKey: deviceId, deviceId },
    creditsBefore: FREE_TRYON_CREDITS - usage.usedCount,
  };
}

/**
 * Public /shop try-on — a logged-in customer spends Customer.tryOnCredits; a
 * guest spends their own pre-login pool (GuestTryOnUsage) instead of being
 * blocked outright, nudged to sign in once it's spent (resolveIdentity
 * above). Credits are checked before generation (so an exhausted caller
 * never triggers a paid AI call) and decremented only after a successful
 * generation (a failed attempt doesn't cost a credit either way).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveIdentity(req);
    if ("response" in resolved) return resolved.response;
    const { identity, creditsBefore } = resolved;

    const { id } = await params;

    const product = await db.product.findFirst({
      where: { id, isActive: true, user: { showOnShop: true } },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.imageUrl) {
      return NextResponse.json(
        { error: "This product has no image. Try-on isn't available for it yet." },
        { status: 422 }
      );
    }

    const provider = await getActiveTryOnProvider(product.userId, {
      category: product.category,
    });

    if (!provider.isEnabled()) {
      return NextResponse.json(
        { error: "Virtual try-on is not available — the AI service is not configured." },
        { status: 503 }
      );
    }

    if (!consumeRateLimit(identity.rateLimitKey)) {
      return NextResponse.json(
        {
          error:
            "Too many try-on requests. You can generate up to 5 try-ons every 10 minutes. Please wait and try again.",
        },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No photo provided. Include a 'photo' field in the request." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_SET.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP photos are accepted." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Photo must be under 5 MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const actualMime = detectImageMimeFromBytes(buffer);
    if (!actualMime || !ALLOWED_MIME_SET.has(actualMime)) {
      return NextResponse.json(
        { error: "File content does not match a supported image format. Please upload a real JPEG, PNG, or WebP photo." },
        { status: 400 }
      );
    }

    const result = await provider.generateTryOn({
      productImageUrl: product.imageUrl,
      userPhotoBuffer: buffer,
      userPhotoMimeType: actualMime as TryOnMimeType,
      productCategory: product.category,
      productColor: product.color,
      productId: product.id,
      productTitle: product.title,
      userId: product.userId,
    });

    // Best-effort guard against a negative balance / over-quota under a
    // concurrent request race — decrements/increments only if there's still
    // room, for either identity kind.
    let creditsRemaining: number;
    if (identity.kind === "customer") {
      const { count } = await db.customer.updateMany({
        where: { id: identity.customerId, tryOnCredits: { gt: 0 } },
        data: { tryOnCredits: { decrement: 1 } },
      });
      creditsRemaining = count > 0 ? creditsBefore - 1 : creditsBefore;
    } else {
      const { count } = await db.guestTryOnUsage.updateMany({
        where: { deviceId: identity.deviceId, usedCount: { lt: FREE_TRYON_CREDITS } },
        data: { usedCount: { increment: 1 } },
      });
      creditsRemaining = count > 0 ? creditsBefore - 1 : creditsBefore;
    }

    return NextResponse.json({ tryOnUrl: normalizeTryOnUrl(result.url), creditsRemaining });
  } catch (err) {
    const message = (err as Error).message ?? "";

    if (message.includes("SAFETY") || message.includes("safety")) {
      return NextResponse.json(
        {
          error:
            "The AI could not process this photo due to content restrictions. Please try a different photo.",
        },
        { status: 422 }
      );
    }

    console.error("[shop tryon] Unexpected error:", err);
    return NextResponse.json(
      { error: "Try-on generation failed. Please try again." },
      { status: 500 }
    );
  }
}
