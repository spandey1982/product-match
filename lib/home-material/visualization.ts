/**
 * Quick AI Preview — apply a swatch's colour/finish to a user-selected wall
 * region while leaving the rest of the room untouched.
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
 */
import sharp from "sharp";
import { uploadWithRetry } from "@/lib/cloudinary";
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-3.1-flash-image";
const MAX_MODEL_EDGE = 1536;

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
  /** Fractional rect [0,1] — same shape stored on HmSurface.geometryData. */
  rect: { x: number; y: number; width: number; height: number };
  swatch: QuickPreviewSwatch;
  hmUserId: string;
  visualizationId: string;
}

export interface QuickPreviewResult {
  url: string;
  width: number;
  height: number;
  bytes: number;
  model: string;
}

/**
 * Deterministic prompt built ONLY from structured swatch fields — never raw
 * user text — per the AI-boundaries rule that the product database defines
 * the product, the LLM doesn't (Constitution Principle 7, CLAUDE.md §18
 * "never trust user input").
 */
export function buildQuickPreviewPrompt(swatch: QuickPreviewSwatch): string {
  const parts: string[] = [];
  parts.push(
    `You are editing a photo of a room. Change the appearance of ONLY the highlighted wall region to show this wall material:`
  );
  parts.push(`- Material: ${swatch.name}`);
  if (swatch.colorName) parts.push(`- Colour: ${swatch.colorName}${swatch.colorHex ? ` (${swatch.colorHex})` : ""}`);
  if (swatch.finish) parts.push(`- Finish: ${swatch.finish}`);
  if (swatch.patternName) parts.push(`- Pattern: ${swatch.patternName}`);
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
  if (!res.ok) throw new Error(`Failed to fetch room image: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function runQuickPreviewVisualization(
  input: QuickPreviewInput
): Promise<QuickPreviewResult | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { error: "AI generation is not configured." };
  }

  const original = await fetchImageBuffer(input.roomImageUrl);
  const meta = await sharp(original).rotate().metadata();
  const origWidth = meta.width ?? 0;
  const origHeight = meta.height ?? 0;
  if (origWidth <= 0 || origHeight <= 0) return { error: "Could not read the room photo." };

  // Mask at native resolution: white = selected wall, black = keep untouched.
  const { x, y, width, height } = input.rect;
  const rectPx = {
    left: Math.round(x * origWidth),
    top: Math.round(y * origHeight),
    width: Math.max(1, Math.round(width * origWidth)),
    height: Math.max(1, Math.round(height * origHeight)),
  };
  const maskNative = await sharp({
    create: { width: origWidth, height: origHeight, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: rectPx.width, height: rectPx.height, channels: 3, background: { r: 255, g: 255, b: 255 } },
        })
          .png()
          .toBuffer(),
        left: rectPx.left,
        top: rectPx.top,
      },
    ])
    .png()
    .toBuffer();

  // Same downscale applied to the base image AND the mask, together — a
  // real, previously-fixed bug in this codebase's other AI pipeline was
  // exactly this asymmetry (see PROJECT_KNOWLEDGE.md "Preprocessing").
  const scale = Math.min(1, MAX_MODEL_EDGE / Math.max(origWidth, origHeight));
  const modelWidth = Math.round(origWidth * scale);
  const modelHeight = Math.round(origHeight * scale);
  const modelBase = await sharp(original).rotate().resize(modelWidth, modelHeight).jpeg({ quality: 90 }).toBuffer();
  const modelMask = await sharp(maskNative).resize(modelWidth, modelHeight).png().toBuffer();

  const prompt = buildQuickPreviewPrompt(input.swatch);
  const aspectRatio = nearestAspectRatio(modelWidth, modelHeight);

  const parts: Array<Record<string, unknown>> = [
    { inline_data: { mime_type: "image/jpeg", data: modelBase.toString("base64") } },
    { inline_data: { mime_type: "image/png", data: modelMask.toString("base64") } },
    { text: prompt },
  ];
  const requestBytes = modelBase.length + modelMask.length;

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
      imageInputs: 2,
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
      imageInputs: 2,
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
      imageInputs: 2,
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
      imageInputs: 2,
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
    imageInputs: 2,
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
  };
}
