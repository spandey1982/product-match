/**
 * Resolves a CONCRETE hero-source-mode (already decided by hero-source.ts)
 * into an actual clean image URL to composite onto — synchronously, for the
 * two fast modes. Deliberately diverges from
 * lib/presenter-reel/orchestrator.ts's findGeneratedFrontPhoto(), which
 * THROWS when no generated photo exists: this resolver must never throw —
 * it degrades through reuse-catalogue → product-only, and only reports
 * "no-image-available" if literally nothing exists to composite onto. It
 * never silently escalates to a paid generate-new call on its own — that
 * would spend the retailer's money on a path they didn't ask for.
 */
import { db } from "@/lib/db";
import { stripDeliveryTransforms } from "@/lib/model-gen/crop-templates";
import type { HeroSourceMode } from "./types";

// Same objective filter lib/presenter-reel/orchestrator.ts and
// lib/catalogue-motion/reel/reference-resolver.ts each independently use —
// duplicated rather than imported, since neither module exports it and
// reaching into either's internals would couple modules meant to stay
// independent (same reasoning presenter-reel's own header comment gives).
const GENERATED_OBJECTIVES = ["catalogue", "quick_listing"];

export interface HeroResolution {
  ok: true;
  /** The mode actually used — may differ from the requested mode if it fell back. */
  resolvedMode: HeroSourceMode;
  heroImageUrl: string;
  heroSourceProductImageId: string | null;
}

export interface HeroResolutionNeedsGeneration {
  ok: false;
  reason: "needs-generation";
}

export interface HeroResolutionUnavailable {
  ok: false;
  reason: "no-image-available";
}

export type HeroResolutionResult = HeroResolution | HeroResolutionNeedsGeneration | HeroResolutionUnavailable;

async function findGeneratedCataloguePhoto(
  productId: string
): Promise<{ id: string; url: string } | null> {
  const row = await db.productImage.findFirst({
    where: { productId, view: "front", objective: { in: GENERATED_OBJECTIVES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true },
  });
  return row;
}

export async function resolveHeroImageSync(
  mode: HeroSourceMode,
  product: { id: string; imageUrl: string | null }
): Promise<HeroResolutionResult> {
  if (mode === "generate-new") {
    return { ok: false, reason: "needs-generation" };
  }

  if (mode === "reuse-catalogue") {
    const photo = await findGeneratedCataloguePhoto(product.id);
    if (photo) {
      return {
        ok: true,
        resolvedMode: "reuse-catalogue",
        heroImageUrl: stripDeliveryTransforms(photo.url),
        heroSourceProductImageId: photo.id,
      };
    }
    // No generated catalogue photo — fall back to product-only rather than
    // failing or silently spending on a generate-new the retailer didn't ask for.
    if (product.imageUrl) {
      return {
        ok: true,
        resolvedMode: "product-only",
        heroImageUrl: product.imageUrl,
        heroSourceProductImageId: null,
      };
    }
    return { ok: false, reason: "no-image-available" };
  }

  // mode === "product-only"
  if (product.imageUrl) {
    return {
      ok: true,
      resolvedMode: "product-only",
      heroImageUrl: product.imageUrl,
      heroSourceProductImageId: null,
    };
  }
  // Still degrade rather than fail outright — a generated catalogue photo is
  // a strictly better substitute than nothing, even when product-only was
  // explicitly requested but the raw upload is somehow missing.
  const photo = await findGeneratedCataloguePhoto(product.id);
  if (photo) {
    return {
      ok: true,
      resolvedMode: "reuse-catalogue",
      heroImageUrl: stripDeliveryTransforms(photo.url),
      heroSourceProductImageId: photo.id,
    };
  }
  return { ok: false, reason: "no-image-available" };
}
