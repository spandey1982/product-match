import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  TRYON_ALLOWED_MIME_TYPES,
  type TryOnMimeType,
  detectImageMimeFromBytes,
  createRateLimiter,
} from "@/lib/tryon";
import { getActiveTryOnProvider } from "@/lib/providers/active";
import { normalizeTryOnUrl } from "@/lib/image-normalize";

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Module-level — per-process, resets on server restart. Sufficient for a
// single-instance Railway deployment. Replace with Redis if that changes.
const consumeRateLimit = createRateLimiter(5, 10 * 60 * 1000); // 5 per 10 min

// ─── Allowed types set for fast lookup ───────────────────────────────────────
const ALLOWED_MIME_SET = new Set<string>(TRYON_ALLOWED_MIME_TYPES);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Authentication ─────────────────────────────────────────────────────
    const session = await requireAuth();
    const { id } = await params;

    // ── Product ownership check ────────────────────────────────────────────
    const product = await db.product.findFirst({
      where: { id, userId: session.id },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (!product.imageUrl) {
      return NextResponse.json(
        { error: "This product has no image. Upload a product image before using try-on." },
        { status: 422 }
      );
    }

    // ── Resolve the active provider for this retailer ──────────────────────
    // Reads the store's chosen provider (default Gemini) and falls back to
    // Gemini if the choice is unavailable, so a stale selection can't break
    // try-on. When the choice is Gemini, this is identical to prior behavior.
    const provider = await getActiveTryOnProvider(session.id, {
      category: product.category,
    });

    if (!provider.isEnabled()) {
      return NextResponse.json(
        { error: "Virtual try-on is not available — the AI service is not configured." },
        { status: 503 }
      );
    }

    // ── Rate limiting ──────────────────────────────────────────────────────
    if (!consumeRateLimit(session.id)) {
      return NextResponse.json(
        {
          error:
            "Too many try-on requests. You can generate up to 5 try-ons every 10 minutes. Please wait and try again.",
        },
        { status: 429 }
      );
    }

    // ── Parse multipart form data ──────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No photo provided. Include a 'photo' field in the request." },
        { status: 400 }
      );
    }

    // ── Declared MIME type check ───────────────────────────────────────────
    if (!ALLOWED_MIME_SET.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP photos are accepted." },
        { status: 400 }
      );
    }

    // ── File size check ────────────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Photo must be under 5 MB." },
        { status: 400 }
      );
    }

    // ── Read and magic-byte validate ───────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const actualMime = detectImageMimeFromBytes(buffer);
    if (!actualMime || !ALLOWED_MIME_SET.has(actualMime)) {
      return NextResponse.json(
        { error: "File content does not match a supported image format. Please upload a real JPEG, PNG, or WebP photo." },
        { status: 400 }
      );
    }

    // ── Generate try-on ────────────────────────────────────────────────────
    const result = await provider.generateTryOn({
      productImageUrl: product.imageUrl,
      userPhotoBuffer: buffer,
      userPhotoMimeType: actualMime as TryOnMimeType,
      productCategory: product.category,
      productColor: product.color,
      productId: product.id,
      productTitle: product.title,
      userId: session.id,
    });

    return NextResponse.json({ tryOnUrl: normalizeTryOnUrl(result.url) });
  } catch (err) {
    const message = (err as Error).message ?? "";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Surface content-policy refusals with a friendlier message
    if (message.includes("SAFETY") || message.includes("safety")) {
      return NextResponse.json(
        {
          error:
            "The AI could not process this photo due to content restrictions. Please try a different photo.",
        },
        { status: 422 }
      );
    }

    console.error("[tryon] Unexpected error:", err);
    return NextResponse.json(
      { error: "Try-on generation failed. Please try again." },
      { status: 500 }
    );
  }
}
