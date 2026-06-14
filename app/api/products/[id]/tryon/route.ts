import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TRYON_ALLOWED_MIME_TYPES, type TryOnMimeType } from "@/lib/tryon";
import { getActiveTryOnProvider } from "@/lib/providers/active";

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Module-level Map is per-process. Resets on server restart.
// Sufficient for single-instance Railway deployment. Replace with Redis if the
// deployment becomes multi-instance.
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function consumeRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (rateLimitStore.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX) return false; // rejected
  recent.push(now);
  rateLimitStore.set(userId, recent);
  return true; // accepted
}

// ─── Magic-byte MIME detection ────────────────────────────────────────────────
// Validates that file bytes actually match the declared type.
// Prevents malicious uploads that disguise non-images as JPEG/PNG/WebP.
function detectMimeFromBytes(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";

  // WebP: RIFF....WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";

  return null;
}

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
    const provider = await getActiveTryOnProvider(session.id);

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

    const actualMime = detectMimeFromBytes(buffer);
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

    return NextResponse.json({ tryOnUrl: result.url });
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
