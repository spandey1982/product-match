/**
 * Re-encode a freshly generated image before it's stored, applied right after
 * Gemini's response and before the Cloudinary upload.
 *
 * Why this exists: Gemini's own JPEG encoder is not size-optimal. Verified via
 * local A/B (docs/research/IMAGE_RND_LOG.md, 2026-07-04) — mozjpeg re-encode at
 * quality 90 lands at ~17-19% of Gemini's original file size across 1K/2K/4K,
 * visually indistinguishable on detail-crop comparisons (embroidery, zari,
 * lace). This is strictly post-generation: the exact same pixels Gemini
 * decided to draw, just encoded without the waste — never a substitute for
 * generating more detail natively.
 *
 * Non-fatal: any failure falls back to the original buffer/mime so a
 * generation never breaks because of this.
 */
import sharp from "sharp";

export const REENCODE_QUALITY = 90;

export interface Reencoded {
  buffer: Buffer;
  mime: string;
}

export async function reencodeGeneratedImage(
  buffer: Buffer,
  mime: string
): Promise<Reencoded> {
  try {
    const out = await sharp(buffer)
      .jpeg({ quality: REENCODE_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buffer: out, mime: "image/jpeg" };
  } catch (err) {
    console.error("[reencode] failed, using original image:", err);
    return { buffer, mime };
  }
}
