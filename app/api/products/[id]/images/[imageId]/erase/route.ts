import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chargeForCall } from "@/lib/billing/charge";
import { fetchProductImageBuffer } from "@/lib/generate-model-image";
import { parsePartImages } from "@/lib/product/part-slots";
import { runGeminiRegionEdit, stripCloudinaryTransforms } from "@/lib/model-gen/erase";
import { resolveCatalogueStack } from "@/lib/model-gen/catalogue-cards";
import { getBrandingConfig, applyBranding, resolveBrandingPlacement } from "@/lib/model-gen/branding";

const MAX_MASK_BYTES = 5 * 1024 * 1024; // 5 MB — a painted mask is a simple B/W PNG, well under this
const MAX_CORRECTION_CHARS = 500;

/** Decode a `data:image/png;base64,...` URL to a Buffer. Null on anything else. */
function decodeDataUrl(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, imageId } = await params;

    const product = await db.product.findFirst({ where: { id, userId: session.id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const image = await db.productImage.findFirst({ where: { id: imageId, productId: id } });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const body = await req.json();

    // ── Revert: swap url/previousUrl back, one-step undo only ──────────────
    if ((body as { action?: unknown }).action === "revert") {
      if (!image.previousUrl) {
        return NextResponse.json({ error: "No previous version to revert to." }, { status: 400 });
      }
      const reverted = await db.productImage.update({
        where: { id: imageId },
        data: { url: image.previousUrl, previousUrl: null, editedAt: null },
      });
      return NextResponse.json({ url: reverted.url });
    }

    // ── Finalize: recompute crop cards derived from this base (pleats/blouse
    // from front, pallu from back) and persist them — the retailer's signal
    // that the current attempt is the one they want to keep. ───────────────
    if ((body as { action?: unknown }).action === "finalize") {
      if (image.view !== "front" && image.view !== "back") {
        return NextResponse.json({ error: "Only front/back images can be finalized." }, { status: 400 });
      }

      const allProductImages = await db.productImage.findMany({ where: { productId: id } });
      const frontImg = allProductImages.find((i) => i.view === "front");
      const backImg = allProductImages.find((i) => i.view === "back");

      // resolveCatalogueStack (lib/model-gen/catalogue-cards.ts) is the same
      // pure function the original generation used to derive crop cards from
      // base shots — reused here rather than re-deriving cascade rules by
      // hand, so this stays correct if the card-stack definition ever
      // changes. It expects RAW (pre-branding) base URLs, same as engine.ts.
      const baseShots: Partial<Record<"front" | "back", { url: string; provider: string }>> = {};
      if (frontImg) baseShots.front = { url: stripCloudinaryTransforms(frontImg.url), provider: "gemini" };
      if (backImg) baseShots.back = { url: stripCloudinaryTransforms(backImg.url), provider: "gemini" };

      const resolved = resolveCatalogueStack({
        category: product.category,
        baseShots,
        partImages: parsePartImages(product.partImages),
        mainImageUrl: product.imageUrl ?? "",
      });

      const branding = await getBrandingConfig(session.id);
      const willBrand = branding.enabled && Boolean(branding.logoPublicId || branding.storeName?.trim());

      const updated: Array<{ view: string; url: string }> = [];
      for (const card of resolved) {
        if (card.view === "front" || card.view === "back") continue; // base shots aren't cascade targets
        let finalUrl = card.url;
        if (willBrand) {
          const placement = await resolveBrandingPlacement(card.url, branding.position, { mark: "light", brightness: 0.5 });
          finalUrl = applyBranding(card.url, branding, placement);
        }
        const existing = allProductImages.find((i) => i.view === card.view);
        if (existing && existing.url !== finalUrl) {
          await db.productImage.update({ where: { id: existing.id }, data: { url: finalUrl } });
          updated.push({ view: card.view, url: finalUrl });
        }
      }

      return NextResponse.json({ updated });
    }

    // ── Edit ─────────────────────────────────────────────────────────────
    if (image.view !== "front" && image.view !== "back") {
      return NextResponse.json(
        { error: "Only front/back images can be edited — cropped cards are derived from them automatically." },
        { status: 400 }
      );
    }
    const correctionText = String((body as { correctionText?: unknown }).correctionText ?? "").trim();
    const referencePartSlot = (body as { referencePartSlot?: unknown }).referencePartSlot;
    const maskBuffer = decodeDataUrl((body as { maskDataUrl?: unknown }).maskDataUrl);

    if (!maskBuffer || maskBuffer.length === 0) {
      return NextResponse.json({ error: "No mask provided. Paint the region you want to fix." }, { status: 400 });
    }
    if (maskBuffer.length > MAX_MASK_BYTES) {
      return NextResponse.json({ error: "Mask image is too large." }, { status: 400 });
    }
    if (!correctionText && !referencePartSlot) {
      return NextResponse.json(
        { error: "Describe the correction, or pick a reference photo, before submitting." },
        { status: 400 }
      );
    }
    if (correctionText.length > MAX_CORRECTION_CHARS) {
      return NextResponse.json({ error: `Correction text must be under ${MAX_CORRECTION_CHARS} characters.` }, { status: 400 });
    }

    let reference: { buffer: Buffer; mime: string; label: string } | null = null;
    if (typeof referencePartSlot === "string" && referencePartSlot) {
      const part = parsePartImages(product.partImages).find((p) => p.slot === referencePartSlot);
      if (!part) {
        return NextResponse.json({ error: "Selected reference photo was not found on this product." }, { status: 400 });
      }
      const fetched = await fetchProductImageBuffer(part.url);
      if (!fetched) {
        return NextResponse.json({ error: "Could not load the selected reference photo." }, { status: 502 });
      }
      reference = { buffer: fetched.buffer, mime: fetched.mime, label: part.label };
    }

    const charge = await chargeForCall(session.id, "erase");
    if ("insufficientCredits" in charge) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "Not enough credits to fix this region. Contact your admin to add more credits.",
          remainingPercentage: charge.remainingPercentage,
        },
        { status: 402 }
      );
    }

    const result = await runGeminiRegionEdit({
      productId: id,
      userId: session.id,
      baseImageUrl: image.url,
      maskBuffer,
      correctionText,
      reference,
      usage: { feature: "erase", storeId: session.id, userId: session.id },
    });

    if (!result) {
      return NextResponse.json(
        { error: "The correction could not be generated. Please try again." },
        { status: 500 }
      );
    }

    const updated = await db.productImage.update({
      where: { id: imageId },
      data: { url: result.url, previousUrl: image.url, editedAt: new Date() },
    });

    return NextResponse.json({ url: updated.url });
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[erase] Unexpected error:", err);
    return NextResponse.json({ error: "Fix-region request failed. Please try again." }, { status: 500 });
  }
}
