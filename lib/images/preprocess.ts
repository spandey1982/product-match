/**
 * Controlled product-image preprocessing, applied right before the product is
 * sent to the generation model.
 *
 * Why this exists: today the full uploaded image (up to 5 MB) is handed to
 * Gemini, which downsamples it internally with its own resampler — uncontrolled
 * data loss. This replaces that with a deliberate, high-fidelity step:
 *
 *   • Lanczos3 downscale (the highest-quality resampling kernel) to the model's
 *     effective input resolution — bigger wastes input tokens for diminishing
 *     understanding; the model caps its own internal resolution.
 *   • A light sharpen to counter resize softening (the "lanczos + sharpen" the
 *     master delivery variant also uses, but on the INPUT side).
 *   • A high-quality WebP encode — preserves the resized detail far better than
 *     a low-quality JPEG re-compress right before the model sees it. (Converting
 *     an already-lossy JPG to a "lossless" container can't recover lost detail,
 *     so we use efficient near-visually-lossless WebP, accepted by Gemini.)
 *
 * Non-fatal: any failure falls back to the original buffer/mime so generation
 * never breaks.
 */
import sharp from "sharp";

/**
 * Model-input cap for generation. 1024px is a deliberate balance: enough detail
 * for faithful synthesis while trimming input tokens/cost vs the old 1280. The
 * Lanczos3 downscale below keeps this controlled (no uncontrolled model-side
 * downsample). Revisit upward only if generation quality visibly suffers.
 */
export const PRODUCT_INPUT_MAX_PX = 1024;

export interface Preprocessed {
  buffer: Buffer;
  mime: string;
}

export async function preprocessProductImage(
  buffer: Buffer,
  mime: string
): Promise<Preprocessed> {
  try {
    const out = await sharp(buffer)
      .rotate() // honour EXIF orientation before resizing
      .resize({
        width: PRODUCT_INPUT_MAX_PX,
        height: PRODUCT_INPUT_MAX_PX,
        fit: "inside",
        withoutEnlargement: true, // never upscale a small source
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen() // gentle unsharp to counter resize softening
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
    return { buffer: out, mime: "image/webp" };
  } catch (err) {
    console.error("[preprocess] failed, using original image:", err);
    return { buffer, mime };
  }
}
