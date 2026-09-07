/**
 * Reel shot → source image resolver — the reel equivalent of
 * lib/catalogue-motion/source-resolver.ts, with one added concern that
 * catalogue mode never had: WHICH image a shot should animate.
 *
 * Resolution rule, per shot:
 *   - Detail shots (isDetailTruth: true) → ALWAYS the raw original source
 *     photo, cropped — never the generated model/mannequin photo. See
 *     reel-types.ts's doc comment for why (fabric-truth, not identity). As of
 *     2026-09-06 this shot type is ai-motion, not pan-zoom (see
 *     reel-storyboards.ts's detailShot() doc comment), so its crop also gets
 *     fit to Veo's 9:16 request aspect like any other ai-motion shot — a
 *     pan-zoom clip never needed that since it crops/scales to its exact
 *     output shape internally regardless of source aspect ratio.
 *   - Mannequin presentation → ALWAYS the raw original source photo for
 *     every shot. There is no "generated mannequin photo" to prefer — the
 *     mannequin look comes entirely from reel-prompt-builder's mannequin
 *     constraint block applied to the real product photo.
 *   - Model presentation, non-detail shots → ONLY the product's existing
 *     generated on-model photo (ProductImage with objective "catalogue" or
 *     "quick_listing"). If none exists for a given sourceBase, every shot
 *     needing that sourceBase is skipped entirely rather than falling back
 *     to the raw original upload — that fallback was tried in v1 and
 *     reverted (2026-09-06) after two separate live-tested failures: asking
 *     Veo to invent a full model+drape+scene from a flat/raw photo produces
 *     the WRONG garment pattern (a follow-up single-shot experiment,
 *     documented in research/reel-engine-components.html), and applying a
 *     worn-garment engagementCue ("the fabric settles...") to a raw photo
 *     that has no person in it at all (common for flat-lay/ghost-mannequin
 *     product photography) made Veo hallucinate disembodied hands to
 *     reconcile the two (a live kurta test, same document). Skipping is the
 *     conservative, honest choice: fewer accepted shots in the final reel is
 *     a better outcome than a shot that's actively likely to hallucinate.
 *     Note this still isn't frame-chaining across shots (v1 simplification,
 *     documented in the implementation plan): every ai-motion shot in the
 *     reel references the SAME anchor image, which — even without a face
 *     reference — gives Veo consistent conditioning per shot rather than a
 *     blank slate each time. True cross-shot identity chaining (extracting
 *     a generated frame and feeding it forward) is a real follow-up, not
 *     v1: the orchestrator resolves and dispatches all clips in one batch
 *     today, and chaining needs a genuinely sequential dispatch order.
 */
import { db } from "@/lib/db";
import { cropRegionFor, buildCropUrl, coverCropToAspect, stripDeliveryTransforms, BASE_SHOT_ASPECT, type CropRegion } from "@/lib/model-gen/crop-templates";
import type { ReelStoryboardShot, ReelPresentation } from "./reel-types";

// Matches veo-provider.ts's requested `aspectRatio: "9:16"` parameter.
const VEO_TARGET_ASPECT = 9 / 16;

/**
 * Neck-down crop for excludeFace shots — starts below where hair/shoulders
 * begin in these full-length base shots (matches the same proportions
 * crop-templates.ts's per-category shoulder-level regions already use, e.g.
 * SAREE's blouse region starting at y:0.06 and pallu at y:0.18) with a small
 * safety margin for hair that falls lower in back-view shots. A fixed
 * fraction rather than a category-specific region: every base shot follows
 * the same full-length-model framing convention, so one generic crop works
 * across categories without needing new crop-templates.ts entries for a
 * reel-only concern.
 */
const NECK_DOWN_REGION: CropRegion = { x: 0, y: 0.22, w: 1, h: 0.76 };

const GENERATED_OBJECTIVES = ["catalogue", "quick_listing"];

export interface ReelSourceImages {
  front?: string;
  back?: string;
}

export interface ResolvedReelShotSource {
  shot: ReelStoryboardShot;
  imageUrl: string;
  cropRegion?: CropRegion;
}

async function findGeneratedPhoto(productId: string, view: "front" | "back"): Promise<string | undefined> {
  const row = await db.productImage.findFirst({
    where: { productId, view, objective: { in: GENERATED_OBJECTIVES } },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  // ProductImage.url has retailer branding (store chip/wordmark) baked
  // directly into the stored Cloudinary URL by applyBranding() — there is no
  // separate clean field. A reel anchor must animate the actual product
  // photo, never a branded delivery variant, so strip back to the clean
  // base before this URL is used for anything (Veo, or our own crop math).
  return row ? stripDeliveryTransforms(row.url) : undefined;
}

/**
 * The image every non-detail (ai-motion) shot for a given sourceBase should
 * animate — see the resolution rule above. Computed once per sourceBase
 * ("front"/"back") actually used by the storyboard, not once per shot.
 */
async function resolveAnchor(
  productId: string,
  presentation: ReelPresentation,
  sourceBase: "front" | "back",
  rawImages: ReelSourceImages,
): Promise<string | undefined> {
  if (presentation === "mannequin") return rawImages[sourceBase];
  // model presentation: a generated on-model photo only — see the module
  // doc comment above for why the raw upload is no longer an acceptable
  // fallback here. Skips the shot (via anchorFor returning undefined)
  // rather than risk either of the two failure modes that fallback caused.
  return findGeneratedPhoto(productId, sourceBase);
}

export interface ResolveReelShotSourcesResult {
  resolved: ResolvedReelShotSource[];
  /** Human-readable note when one or more shots were skipped for lacking a generated on-model photo — null when nothing was skipped. */
  skippedSourceNote: string | null;
}

export async function resolveReelShotSources(
  productId: string,
  category: string | null | undefined,
  presentation: ReelPresentation,
  shots: ReelStoryboardShot[],
  rawImages: ReelSourceImages,
): Promise<ResolveReelShotSourcesResult> {
  const anchorCache = new Map<"front" | "back", string | undefined>();
  async function anchorFor(sourceBase: "front" | "back"): Promise<string | undefined> {
    if (!anchorCache.has(sourceBase)) {
      anchorCache.set(sourceBase, await resolveAnchor(productId, presentation, sourceBase, rawImages));
    }
    return anchorCache.get(sourceBase);
  }

  const resolved: ResolvedReelShotSource[] = [];
  const skippedLabels: string[] = [];

  for (const shot of shots) {
    if (shot.isDetailTruth) {
      // Always the raw source, cropped — fabric truth, never the generated photo.
      const rawUrl = rawImages[shot.sourceBase];
      if (!rawUrl) continue;
      if (shot.cropId) {
        const region = cropRegionFor(category, shot.cropId);
        if (!region) continue;
        // ai-motion detail shots (2026-09-06 conversion from pan-zoom) go to
        // Veo, which needs a 9:16-fit source like every other ai-motion shot
        // — an unfit crop gets pillarboxed and Veo invents decorative filler
        // around the edges (same reasoning as the non-detail branch below).
        // Pan-zoom never needed this: it crops/scales to its exact output
        // shape internally regardless of the source's aspect ratio.
        const fitted = shot.renderMode === "ai-motion" ? coverCropToAspect(region.region, BASE_SHOT_ASPECT, VEO_TARGET_ASPECT) : region.region;
        resolved.push({ shot, imageUrl: buildCropUrl(rawUrl, fitted), cropRegion: fitted });
      } else {
        resolved.push({ shot, imageUrl: rawUrl });
      }
      continue;
    }

    const anchor = await anchorFor(shot.sourceBase);
    if (!anchor) {
      // model presentation with no generated on-model photo for this
      // sourceBase (mannequin presentation always resolves via the raw
      // image above, so it never reaches here) — see the module doc
      // comment for why this is a deliberate skip, not a bug.
      if (presentation === "model") skippedLabels.push(`${shot.label} (${shot.sourceBase})`);
      continue;
    }

    if (shot.renderMode === "ai-motion") {
      // Fit to Veo's 9:16 request aspect first — same reasoning as
      // source-resolver.ts's ai-motion branch: an unfit source gets
      // pillarboxed and Veo invents decorative filler around the edges.
      // excludeFace shots start from the neck-down region instead of the
      // full frame, so the face is never in the source Veo receives at all
      // — structural, not just instructed.
      const baseRegion = shot.excludeFace ? NECK_DOWN_REGION : { x: 0, y: 0, w: 1, h: 1 };
      const fitted = coverCropToAspect(baseRegion, BASE_SHOT_ASPECT, VEO_TARGET_ASPECT);
      resolved.push({ shot, imageUrl: buildCropUrl(anchor, fitted), cropRegion: shot.excludeFace ? fitted : undefined });
    } else {
      resolved.push({ shot, imageUrl: anchor });
    }
  }

  const skippedSourceNote = skippedLabels.length
    ? `Skipped ${skippedLabels.join(", ")} — no generated on-model photo exists for that view, and animating the raw upload risks inventing the wrong garment or hallucinating a body onto a model-less photo (research/reel-engine-components.html, Component 15 / Fifth live pipeline test).`
    : null;

  return { resolved, skippedSourceNote };
}
