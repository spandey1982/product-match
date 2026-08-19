import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import {
  TRYON_ALLOWED_MIME_TYPES,
  type TryOnMimeType,
  detectImageMimeFromBytes,
  createRateLimiter,
} from "@/lib/tryon";
import { getActiveTryOnProvider } from "@/lib/providers/active";
import { normalizeTryOnUrl } from "@/lib/image-normalize";
import { SIGN_IN_FOR_CREDITS_MESSAGE, INSUFFICIENT_CREDITS_MESSAGE } from "@/lib/vto-credits/packages";

// Separate instance from the rental/retailer routes' limiters — a shop
// shopper's quota is independent of either.
const consumeRateLimit = createRateLimiter(5, 10 * 60 * 1000); // 5 per 10 min

const ALLOWED_MIME_SET = new Set<string>(TRYON_ALLOWED_MIME_TYPES);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Public /shop try-on — requires a logged-in customer (same reasoning as the
 * rental route: generations must be tied to one account) AND a positive
 * credit balance (Customer.tryOnCredits — new for /shop, the rental route has
 * no such gate). Credits are checked before generation (so a customer with 0
 * credits never triggers a paid AI call) and decremented only after a
 * successful generation (a failed attempt doesn't cost the customer a credit).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: SIGN_IN_FOR_CREDITS_MESSAGE }, { status: 401 });
    }

    const customer = await db.customer.findUnique({
      where: { id: session.id },
      select: { tryOnCredits: true },
    });

    if (!customer || customer.tryOnCredits <= 0) {
      return NextResponse.json({ error: INSUFFICIENT_CREDITS_MESSAGE }, { status: 402 });
    }

    const { id } = await params;

    const product = await db.product.findFirst({
      where: { id, isActive: true },
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

    if (!consumeRateLimit(session.id)) {
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

    // Best-effort guard against a negative balance under a concurrent
    // request race — decrements only if a credit is still available.
    const { count } = await db.customer.updateMany({
      where: { id: session.id, tryOnCredits: { gt: 0 } },
      data: { tryOnCredits: { decrement: 1 } },
    });
    const creditsRemaining = count > 0 ? customer.tryOnCredits - 1 : customer.tryOnCredits;

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
