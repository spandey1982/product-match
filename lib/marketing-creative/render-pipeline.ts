/**
 * Runs renderer.tsx once per requested canvas and uploads each result —
 * shared by both the synchronous (reuse-catalogue/product-only) and async
 * (generate-new) paths in orchestrator.ts, so there is exactly one place
 * that fetches the hero bytes, resolves the logo, and drives the render
 * loop.
 */
import { fetchProductImageBuffer } from "@/lib/generate-model-image";
import { uploadWithRetry } from "@/lib/cloudinary";
import { getImageDimensions } from "@/lib/image-utils";
import { db } from "@/lib/db";
import { resolveCanvas } from "./canvas";
import { resolveTemplate } from "./templates";
import { renderCreativeCanvas } from "./renderer";
import type { CanvasKey, ContentMode, DeterministicCopy, RenderedOutput, TemplateFamily } from "./types";

function logoUrlFromPublicId(publicId: string): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;
  // f_auto,q_auto keeps this small — this is composited at overlay size
  // (~72-96px), never displayed at native resolution.
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,h_192/${publicId}`;
}

async function resolveLogoDataUri(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { logoPublicId: true } });
  if (!user?.logoPublicId) return null;
  const url = logoUrlFromPublicId(user.logoPublicId);
  if (!url) return null;
  const logo = await fetchProductImageBuffer(url);
  if (!logo) return null;
  return `data:${logo.mime};base64,${logo.buffer.toString("base64")}`;
}

export interface RunRenderPipelineInput {
  productId: string;
  userId: string;
  heroImageUrl: string;
  templateFamily: TemplateFamily;
  contentMode: ContentMode;
  copy: DeterministicCopy;
  aspectRatios: CanvasKey[];
  /** ClientProfile.accentColor, hex or null — see renderer.tsx. */
  accentColor: string | null;
}

/**
 * Renders and uploads every requested canvas. Fetches the hero image and
 * resolves the logo exactly once, reused across every canvas in this
 * request — a real cost that stays flat regardless of how many aspect
 * ratios one request asks for.
 */
export async function runRenderPipeline(input: RunRenderPipelineInput): Promise<RenderedOutput[]> {
  const hero = await fetchProductImageBuffer(input.heroImageUrl);
  if (!hero) {
    throw new Error(`Could not fetch hero image: ${input.heroImageUrl}`);
  }
  const logoDataUri = await resolveLogoDataUri(input.userId);

  const outputs: RenderedOutput[] = [];
  for (const key of input.aspectRatios) {
    const canvas = resolveCanvas(key);
    const template = resolveTemplate(
      input.templateFamily,
      input.contentMode,
      Boolean(input.copy.priceText || input.copy.discountBadge),
      Boolean(logoDataUri)
    );

    const rendered = await renderCreativeCanvas({
      canvas,
      template,
      copy: input.copy,
      heroBuffer: hero.buffer,
      logoDataUri,
      accentColor: input.accentColor,
    });

    const dataUri = `data:${rendered.mime};base64,${rendered.buffer.toString("base64")}`;
    const uploaded = await uploadWithRetry(dataUri, {
      folder: "product-match/marketing-creative",
      tags: [`product:${input.productId}`, `canvas:${key}`],
    });

    const dims = getImageDimensions(rendered.buffer, rendered.mime) ?? { width: canvas.width, height: canvas.height };
    outputs.push({ aspectRatio: key, url: uploaded.secure_url, width: dims.width, height: dims.height });
  }

  return outputs;
}
