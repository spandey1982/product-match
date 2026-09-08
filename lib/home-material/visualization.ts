/**
 * Applies a swatch's colour/finish (or a user-uploaded reference photo) to
 * a user-selected wall region while leaving the rest of the room
 * untouched. Actually produces BOTH of the brief's visualization fidelity
 * tiers depending on the input, not just "Quick AI Preview" — see
 * QuickPreviewResult.mode.
 *
 * Independently implemented for this domain (not a call into
 * lib/model-gen/erase.ts, which is fashion/garment-image tuned — aspect
 * ratio forced to 3:4, branding, product-specific Cloudinary tags). The
 * masked-composite TECHNIQUE is deliberately the same one proven there
 * (see docs/home-material/README.md "architecturally inspired by"):
 * Gemini's generateContent has no structured mask parameter, so this does
 * NOT trust the model to respect the selected region — it generates a
 * full-image edit candidate, then composites that candidate against the
 * ORIGINAL room photo through a feathered mask via sharp. That composite is
 * what actually guarantees everything outside the selected wall comes back
 * pixel-identical, regardless of model behavior (Constitution Principle 2).
 *
 * The mask is an arbitrary POLYGON (not a rectangle, as of 2026-09-07) so
 * the selection can hug the wall's real outline — rendered as an SVG and
 * rasterized via sharp.
 */
import sharp from "sharp";
import { uploadWithRetry } from "@/lib/cloudinary";
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-3.1-flash-image";
const MAX_MODEL_EDGE = 1536;

export interface Point {
  x: number;
  y: number;
}

export interface QuickPreviewSwatch {
  id: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  finish: string | null;
  patternName: string | null;
}

export interface QuickPreviewInput {
  roomImageUrl: string;
  /** Fractional polygon points [0,1] — same shape stored on HmSurface.geometryData. */
  points: Point[];
  swatch: QuickPreviewSwatch;
  /**
   * A user-uploaded photo of the actual material (custom swatch), if any.
   * When present, this is sent as a reference image and the prompt asks
   * Gemini to match it directly — real pixels beat a text description for
   * an arbitrary upload we can't characterize in structured fields (see
   * PROJECT_KNOWLEDGE.md, "why real images beat text notes").
   */
  referenceImageUrl?: string | null;
  hmUserId: string;
  visualizationId: string;
}

export interface QuickPreviewResult {
  url: string;
  width: number;
  height: number;
  bytes: number;
  model: string;
  /**
   * "product_accurate" when a real reference image (a custom upload) was
   * used to condition the generation — that's the actual material, not an
   * AI-imagined approximation of a text description, satisfying
   * Constitution Principle 1 ("reality over imagination"). "quick_preview"
   * for a curated swatch described only in text (colour/finish/pattern
   * fields). Not yet distinguishing a further "verified retailer SKU" tier
   * — see docs/home-material/README.md's Product-Accurate mode section.
   */
  mode: "quick_preview" | "product_accurate";
}

/**
 * Deterministic prompt built ONLY from structured swatch fields (or a
 * reference-image instruction) — never raw user text — per the
 * AI-boundaries rule that the product database defines the product, the
 * LLM doesn't (Constitution Principle 7, CLAUDE.md §18 "never trust user
 * input").
 */
export function buildQuickPreviewPrompt(swatch: QuickPreviewSwatch, hasReferenceImage: boolean): string {
  const parts: string[] = [];
  parts.push(
    `You are editing a photo of a room. Change the appearance of ONLY the highlighted wall region to show this wall material:`
  );
  if (hasReferenceImage) {
    parts.push(
      `- Material: ${swatch.name} — an exact reference photo of this material is included as an additional image. Match its colour, pattern, and texture as closely as possible.`
    );
  } else {
    parts.push(`- Material: ${swatch.name}`);
    if (swatch.colorName) parts.push(`- Colour: ${swatch.colorName}${swatch.colorHex ? ` (${swatch.colorHex})` : ""}`);
    if (swatch.finish) parts.push(`- Finish: ${swatch.finish}`);
    if (swatch.patternName) parts.push(`- Pattern: ${swatch.patternName}`);
  }
  parts.push(
    "Keep every other part of the photo — furniture, floor, ceiling, windows, doors, lighting, and every other wall — exactly as it is in the original. Match the room's existing lighting and shadows realistically on the new wall surface. Do not add, remove, or move any object."
  );
  return parts.join("\n");
}

/** Gemini's imageConfig.aspectRatio only accepts a small fixed set — pick the closest to the room photo's real aspect ratio instead of forcing one designed for garment photography. */
function nearestAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  const candidates: Array<[string, number]> = [
    ["1:1", 1],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ];
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const c of candidates) {
    const diff = Math.abs(Math.log(ratio) - Math.log(c[1]));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best[0];
}

function featherPxFor(width: number, height: number): number {
  return Math.max(8, Math.round(Math.min(width, height) * 0.01));
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Renders an arbitrary polygon as a white-on-black mask at the given pixel size — the SVG is rasterized by sharp, so this supports any shape, not just an axis-aligned rect. */
async function renderPolygonMask(points: Point[], width: number, height: number): Promise<Buffer> {
  const pointsAttr = points.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(" ");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="black"/><polygon points="${pointsAttr}" fill="white"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function runQuickPreviewVisualization(
  input: QuickPreviewInput
): Promise<QuickPreviewResult | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { error: "AI generation is not configured." };
  }
  if (input.points.length < 3) {
    return { error: "Invalid wall selection." };
  }

  const original = await fetchImageBuffer(input.roomImageUrl);
  const meta = await sharp(original).rotate().metadata();
  const origWidth = meta.width ?? 0;
  const origHeight = meta.height ?? 0;
  if (origWidth <= 0 || origHeight <= 0) return { error: "Could not read the room photo." };

  // Mask at native resolution: white = selected wall, black = keep untouched.
  const maskNative = await renderPolygonMask(input.points, origWidth, origHeight);

  // Same downscale applied to the base image AND the mask, together — a
  // real, previously-fixed bug in this codebase's other AI pipeline was
  // exactly this asymmetry (see PROJECT_KNOWLEDGE.md "Preprocessing").
  const scale = Math.min(1, MAX_MODEL_EDGE / Math.max(origWidth, origHeight));
  const modelWidth = Math.round(origWidth * scale);
  const modelHeight = Math.round(origHeight * scale);
  const modelBase = await sharp(original).rotate().resize(modelWidth, modelHeight).jpeg({ quality: 90 }).toBuffer();
  const modelMask = await sharp(maskNative).resize(modelWidth, modelHeight).png().toBuffer();

  let referenceImage: Buffer | null = null;
  if (input.referenceImageUrl) {
    try {
      const refOriginal = await fetchImageBuffer(input.referenceImageUrl);
      referenceImage = await sharp(refOriginal)
        .rotate()
        .resize({ width: MAX_MODEL_EDGE, height: MAX_MODEL_EDGE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (err) {
      console.error("[home-material/visualization] failed to fetch reference image, continuing without it:", err);
    }
  }

  const prompt = buildQuickPreviewPrompt(input.swatch, Boolean(referenceImage));
  const aspectRatio = nearestAspectRatio(modelWidth, modelHeight);

  const parts: Array<Record<string, unknown>> = [
    { inline_data: { mime_type: "image/jpeg", data: modelBase.toString("base64") } },
    { inline_data: { mime_type: "image/png", data: modelMask.toString("base64") } },
  ];
  if (referenceImage) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: referenceImage.toString("base64") } });
  }
  parts.push({ text: prompt });

  const imageInputs = 2 + (referenceImage ? 1 : 0);
  const requestBytes = modelBase.length + modelMask.length + (referenceImage?.length ?? 0);

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { imageSize: "1K", aspectRatio },
          },
        }),
      }
    );
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_visualization",
      operation: "quick_preview",
      requestBytes,
      imageInputs,
      userId: input.hmUserId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
      metadata: { visualizationId: input.visualizationId },
    });
    return { error: "Could not reach the image generation service." };
  }
  const generationMs = Date.now() - t0;

  if (!res.ok) {
    const errText = await res.text();
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_visualization",
      operation: "quick_preview",
      durationMs: generationMs,
      requestBytes,
      imageInputs,
      userId: input.hmUserId,
      status: "error",
      errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
      metadata: { visualizationId: input.visualizationId },
    });
    return { error: "Generation failed. Please try again." };
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
      finishReason?: string;
    }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const usageMeta = data.usageMetadata;
  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    const finishReason = data.candidates?.[0]?.finishReason;
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_visualization",
      operation: "quick_preview",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs: generationMs,
      requestBytes,
      imageInputs,
      userId: input.hmUserId,
      status: "error",
      errorMessage: `No image returned. Finish reason: ${finishReason ?? "unknown"}`,
      metadata: { visualizationId: input.visualizationId },
    });
    return { error: "The AI did not return an image. Please try again." };
  }

  const editedRaw = Buffer.from(imagePart.inlineData!.data, "base64");

  // Composite: resize the full-image candidate back to native resolution,
  // then paste it through a feathered version of the native-resolution
  // mask onto the untouched original — this is what actually enforces
  // "only the selected wall changed," not the prompt instruction alone.
  const editedResized = await sharp(editedRaw).resize(origWidth, origHeight, { fit: "fill" }).toBuffer();
  const featherPx = featherPxFor(origWidth, origHeight);
  const maskAlpha = await sharp(maskNative).greyscale().blur(featherPx).raw().toBuffer();
  const editedWithAlpha = await sharp(editedResized)
    .ensureAlpha()
    .joinChannel(maskAlpha, { raw: { width: origWidth, height: origHeight, channels: 1 } })
    .png()
    .toBuffer();
  const composited = await sharp(original)
    .rotate()
    .resize(origWidth, origHeight, { fit: "fill" })
    .composite([{ input: editedWithAlpha, blend: "over" }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const dataUri = `data:image/jpeg;base64,${composited.toString("base64")}`;
  let uploaded: { secure_url: string } | null = null;
  try {
    uploaded = await uploadWithRetry(dataUri, { folder: "product-match/home-material/visualizations" });
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_visualization",
      operation: "quick_preview",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      imagesGenerated: 1,
      imageInputs,
      requestBytes,
      responseBytes: editedRaw.length,
      durationMs: generationMs,
      userId: input.hmUserId,
      status: "error",
      errorMessage: `cloudinary_upload: ${String(err)}`,
      metadata: { visualizationId: input.visualizationId },
    });
    return { error: "Image storage is temporarily unreachable. The generation succeeded but wasn't saved — please try again." };
  }

  void recordAiUsage({
    provider: "gemini",
    model: MODEL_ID,
    feature: "hm_visualization",
    operation: "quick_preview",
    inputTokens: usageMeta?.promptTokenCount ?? null,
    outputTokens: usageMeta?.candidatesTokenCount ?? null,
    totalTokens: usageMeta?.totalTokenCount ?? null,
    imagesGenerated: 1,
    imageInputs,
    requestBytes,
    responseBytes: editedRaw.length,
    durationMs: generationMs,
    userId: input.hmUserId,
    status: "success",
    metadata: { visualizationId: input.visualizationId, swatchId: input.swatch.id },
  });

  return {
    url: uploaded.secure_url,
    width: origWidth,
    height: origHeight,
    bytes: composited.length,
    model: MODEL_ID,
    mode: referenceImage ? "product_accurate" : "quick_preview",
  };
}
