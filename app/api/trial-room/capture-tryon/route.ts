import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithModule } from "@/lib/client-modules-server";
import {
  TRYON_ALLOWED_MIME_TYPES,
  type TryOnMimeType,
  detectImageMimeFromBytes,
  createRateLimiter,
} from "@/lib/tryon";
import { CAPTURED_GARMENT_CATEGORY } from "@/lib/trial-room-types";
import { getActiveTryOnProvider } from "@/lib/providers/active";
import { normalizeTryOnUrl } from "@/lib/image-normalize";
import { chargeForCall } from "@/lib/billing/charge";

// ─── In-memory rate limiter — mirrors app/api/products/[id]/tryon/route.ts ────
const consumeRateLimit = createRateLimiter(5, 10 * 60 * 1000); // 5 per 10 min

const ALLOWED_MIME_SET = new Set<string>(TRYON_ALLOWED_MIME_TYPES);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

type ValidatedImage = { buffer: Buffer; mime: TryOnMimeType };

async function readValidatedImage(
  file: File | null,
  label: string
): Promise<ValidatedImage | { error: string }> {
  if (!file) {
    return { error: `No ${label} provided. Include a '${label}' field in the request.` };
  }
  if (!ALLOWED_MIME_SET.has(file.type)) {
    return { error: `Only JPEG, PNG, and WebP photos are accepted for the ${label}.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `The ${label} must be under 5 MB.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const actualMime = detectImageMimeFromBytes(buffer);
  if (!actualMime || !ALLOWED_MIME_SET.has(actualMime)) {
    return { error: `The ${label} file content does not match a supported image format.` };
  }

  return { buffer, mime: actualMime as TryOnMimeType };
}

/**
 * POST /api/trial-room/capture-tryon — quick-capture trial room layout only.
 *
 * Generates a try-on from a garment photographed live via the camera, with
 * no catalog Product involved at all (contrast with
 * app/api/products/[id]/tryon/route.ts, which requires a persisted product).
 * Gated on the "trial-room" module exactly like the rest of trial room.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthWithModule("trial-room");

    // Resolve the active provider for this retailer — no category context
    // exists for a captured garment, so auto-routing falls back to its
    // unmapped-category default (Gemini).
    const provider = await getActiveTryOnProvider(session.id, {});

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

    const photoResult = await readValidatedImage(formData.get("photo") as File | null, "photo");
    if ("error" in photoResult) {
      return NextResponse.json({ error: photoResult.error }, { status: 400 });
    }

    const garmentResult = await readValidatedImage(formData.get("garment") as File | null, "garment photo");
    if ("error" in garmentResult) {
      return NextResponse.json({ error: garmentResult.error }, { status: 400 });
    }

    const charge = await chargeForCall(session.id, "tryon_1k");
    if ("insufficientCredits" in charge) {
      return NextResponse.json({
        error: "insufficient_credits",
        message: "Not enough credits to try on this garment. Contact your admin to add more credits.",
        remainingPercentage: charge.remainingPercentage,
      }, { status: 402 });
    }

    const result = await provider.generateTryOn({
      garmentImageBuffer: garmentResult.buffer,
      garmentImageMimeType: garmentResult.mime,
      userPhotoBuffer: photoResult.buffer,
      userPhotoMimeType: photoResult.mime,
      productCategory: CAPTURED_GARMENT_CATEGORY,
      productColor: "",
      productId: `captured-${crypto.randomUUID()}`,
      productTitle: "Captured garment",
      userId: session.id,
    });

    return NextResponse.json({ tryOnUrl: normalizeTryOnUrl(result.url) });
  } catch (err) {
    const message = (err as Error).message ?? "";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (message.includes("SAFETY") || message.includes("safety")) {
      return NextResponse.json(
        {
          error:
            "The AI could not process this photo due to content restrictions. Please try a different photo.",
        },
        { status: 422 }
      );
    }

    console.error("[trial-room/capture-tryon] Unexpected error:", err);
    return NextResponse.json(
      { error: "Try-on generation failed. Please try again." },
      { status: 500 }
    );
  }
}
