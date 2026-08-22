/**
 * Storyboard shot → existing catalogue image resolver.
 *
 * Maps each StoryboardShot to a source image URL, reusing the already-
 * generated catalogue images (front/back base shots + crop regions) instead
 * of generating anything new. No AI calls happen here — pure URL resolution.
 */
import { cropRegionFor, buildCropUrl, type CropRegion } from "@/lib/model-gen/crop-templates";
import type { StoryboardShot } from "./types";

export interface MotionSourceImages {
  front?: string;
  back?: string;
}

export interface ResolvedShotSource {
  shot: StoryboardShot;
  /** Final image URL to animate — a crop when cropId is set, else the base shot. */
  imageUrl: string;
  /** The crop region, if this shot animates a close-up (informs the provider's framing). */
  cropRegion?: CropRegion;
}

/**
 * Resolve every shot in a storyboard to a source image, given the category
 * and the product's available base catalogue shots. Shots whose base image
 * is missing are dropped — the storyboard degrades gracefully rather than
 * failing outright (e.g. a product with no back shot skips back-derived shots).
 */
export function resolveShotSources(
  category: string | null | undefined,
  shots: StoryboardShot[],
  baseImages: MotionSourceImages,
): ResolvedShotSource[] {
  const resolved: ResolvedShotSource[] = [];

  for (const shot of shots) {
    const baseUrl = baseImages[shot.sourceBase];
    if (!baseUrl) continue;

    if (shot.cropId) {
      const region = cropRegionFor(category, shot.cropId);
      if (!region) continue;
      resolved.push({
        shot,
        imageUrl: buildCropUrl(baseUrl, region.region),
        cropRegion: region.region,
      });
      continue;
    }

    resolved.push({ shot, imageUrl: baseUrl });
  }

  return resolved;
}
