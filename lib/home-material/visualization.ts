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
 *
 * Sub-problem B wiring (perspective/angle-correct projection), 2026-09-09:
 * when the caller supplies a confident 4-corner perspective quad (see
 * lib/home-material/wall-detection.ts) AND a real reference texture image
 * exists, this takes a SEPARATE, fully deterministic path instead — no
 * Gemini image-generation call at all. It warps the real reference pixels
 * onto the wall's actual perspective via a homography (validated in an
 * isolated prototype first, see docs/home-material/README.md), then
 * approximates the room's real lighting with a coarse shading-map
 * multiply (a blurred greyscale of the ORIGINAL photo, normalized to the
 * wall's own mean brightness) rather than trusting an AI model to redraw
 * the pattern correctly — Constitution Principle 1 ("reality over
 * imagination") taken as far as it can go: exact geometry, real pixels,
 * only the lighting is approximated. Falls back to the existing
 * Gemini-based path on any failure (degenerate quad, fetch error, etc.)
 * or whenever a quad/reference image isn't available — fully backward
 * compatible with the common straight-on-wall, curated-swatch case.
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
  /** 4-point perspective quad (TL, TR, BR, BL) from wall-detection.ts — null unless the wall is confidently angled. See file header. */
  corners?: Point[] | null;
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
  /** True when this used the deterministic homography+shading path (sub-problem B), not a Gemini image edit. */
  perspectiveCorrected: boolean;
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

/**
 * Reduced from 1%/8px-min to 0.6%/5px-min (2026-09-08) — a known cosmetic
 * artifact: when the AI polygon routes around a small cutout (e.g. a
 * window) via the standard single-path "bridge" technique, blurring the
 * mask at the larger radius could bleed a faint halo across the thin
 * bridge into the cutout's edge. A smaller feather doesn't eliminate the
 * root cause (the bridge isn't necessarily zero-width in the model's own
 * coordinates) but measurably shrinks the affected area — a proportionate
 * fix for a confirmed-cosmetic issue, not a full geometry-aware rewrite.
 * If it resurfaces as a real complaint, the real fix is detecting the
 * bridge and rendering a true multi-subpath SVG hole instead of trusting
 * the model's single self-intersecting point list as one polygon.
 */
function featherPxFor(width: number, height: number): number {
  return Math.max(5, Math.round(Math.min(width, height) * 0.006));
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

// ---------- sub-problem B: homography (perspective/angle-correct projection) ----------
// Validated in an isolated prototype (scratchpad script, not this file)
// before being wired in here — see docs/home-material/README.md.

/** 4 points expected, in TL/TR/BR/BL order — a plain array is used (not a tuple type) to match what wall-detection.ts already validates and hands over. */
function isValidQuad(corners: Point[] | null | undefined): corners is Point[] {
  if (!corners || corners.length !== 4) return false;
  return polygonAreaGeneric(corners) > 0.01;
}

function polygonAreaGeneric(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

function solveLinearSystem(Ain: number[][], bin: number[]): number[] {
  const n = bin.length;
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const div = A[col][col];
    for (let c = col; c < n; c++) A[col][c] /= div;
    b[col] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      if (factor === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= factor * A[col][c];
      b[r] -= factor * b[col];
    }
  }
  return b;
}

/** Maps the unit square (0,0),(1,0),(1,1),(0,1) — the flat texture's own coordinates — onto an arbitrary destination quad, via the standard 4-point DLT solve. Returns a row-major 3x3 matrix. */
function computeHomography(dst: Point[]): number[] {
  const src: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solveLinearSystem(A, b);
  return [...h, 1];
}

function invert3x3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) throw new Error("Singular homography — degenerate quad");
  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
}

function applyHomography(m: number[], x: number, y: number): Point {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = m;
  const w = h31 * x + h32 * y + h33;
  return { x: (h11 * x + h12 * y + h13) / w, y: (h21 * x + h22 * y + h23) / w };
}

function pointInQuad(p: Point, quad: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const xi = quad[i].x, yi = quad[i].y, xj = quad[j].x, yj = quad[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function bilinearSample(data: Buffer, w: number, h: number, channels: number, x: number, y: number): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const px = (xx: number, yy: number, c: number) => (c < channels ? data[(yy * w + xx) * channels + c] : 255);
  const out: number[] = [];
  for (let c = 0; c < 4; c++) {
    const top = px(x0, y0, c) * (1 - fx) + px(x1, y0, c) * fx;
    const bottom = px(x0, y1, c) * (1 - fx) + px(x1, y1, c) * fx;
    out.push(top * (1 - fy) + bottom * fy);
  }
  return out as [number, number, number, number];
}

/** Warps a flat reference texture onto an arbitrary quad using a true projective transform (inverse-mapped, bilinear-sampled) — previously-parallel lines in the texture correctly converge to match the quad's implied perspective. Returns an RGBA PNG at canvas size, transparent outside the quad. */
async function warpTextureOntoQuad(textureBuf: Buffer, canvasW: number, canvasH: number, quad: Point[]): Promise<Buffer> {
  const { data: texData, info } = await sharp(textureBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const texW = info.width, texH = info.height, channels = info.channels;

  const H = computeHomography(quad);
  const Hinv = invert3x3(H);

  const out = Buffer.alloc(canvasW * canvasH * 4, 0);
  const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(canvasW - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(canvasH - 1, Math.ceil(Math.max(...ys)));

  for (let Y = minY; Y <= maxY; Y++) {
    for (let X = minX; X <= maxX; X++) {
      if (!pointInQuad({ x: X + 0.5, y: Y + 0.5 }, quad)) continue;
      const src = applyHomography(Hinv, X + 0.5, Y + 0.5);
      if (src.x < 0 || src.x > 1 || src.y < 0 || src.y > 1) continue;
      const [r, g, bl, a] = bilinearSample(texData, texW, texH, channels, src.x * (texW - 1), src.y * (texH - 1));
      const idx = (Y * canvasW + X) * 4;
      out[idx] = r; out[idx + 1] = g; out[idx + 2] = bl; out[idx + 3] = a;
    }
  }
  return sharp(out, { raw: { width: canvasW, height: canvasH, channels: 4 } }).png().toBuffer();
}

/**
 * Approximates real lighting on the warped texture using a coarse shading
 * map — a heavily blurred greyscale of the ORIGINAL photo, normalized to
 * the wall region's own mean brightness — rather than an AI guess.
 * Brightness/shadow gradients already present in the room (light from a
 * window, a darker corner) carry over onto the perspective-warped
 * material via a per-pixel multiply, clamped to a modest range so it
 * shades rather than blows out or crushes the result.
 */
async function applyShadingMap(warpedRgba: Buffer, canvasW: number, canvasH: number, originalNative: Buffer, quad: Point[]): Promise<Buffer> {
  const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y);
  const bx0 = Math.max(0, Math.floor(Math.min(...xs)));
  const bx1 = Math.min(canvasW, Math.ceil(Math.max(...xs)));
  const by0 = Math.max(0, Math.floor(Math.min(...ys)));
  const by1 = Math.min(canvasH, Math.ceil(Math.max(...ys)));
  const boxW = Math.max(1, bx1 - bx0), boxH = Math.max(1, by1 - by0);

  const stats = await sharp(originalNative).extract({ left: bx0, top: by0, width: boxW, height: boxH }).greyscale().stats();
  const mean = stats.channels[0].mean || 128;

  const blurRadius = Math.max(8, Math.round(Math.min(canvasW, canvasH) * 0.03));
  const { data: shadeData, info: shadeInfo } = await sharp(originalNative)
    .greyscale()
    .blur(blurRadius)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // warpedRgba is a PNG-encoded buffer (warpTextureOntoQuad's return
  // value) — decode it to raw pixels before doing per-pixel arithmetic.
  const { data: warpedData } = await sharp(warpedRgba).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(warpedData);
  for (let y = by0; y < by1; y++) {
    for (let x = bx0; x < bx1; x++) {
      const idx = (y * canvasW + x) * 4;
      if (out[idx + 3] === 0) continue;
      const shadeVal = shadeData[y * shadeInfo.width + x];
      const mult = Math.max(0.6, Math.min(1.4, shadeVal / mean));
      out[idx] = Math.max(0, Math.min(255, Math.round(out[idx] * mult)));
      out[idx + 1] = Math.max(0, Math.min(255, Math.round(out[idx + 1] * mult)));
      out[idx + 2] = Math.max(0, Math.min(255, Math.round(out[idx + 2] * mult)));
    }
  }
  return sharp(out, { raw: { width: canvasW, height: canvasH, channels: 4 } }).png().toBuffer();
}

/** Intersects the warped texture's own quad-shaped alpha with the outline polygon's mask — so an obstruction routed around in the outline (a window, a light switch) stays protected even if the perspective quad geometrically overlaps it. */
async function intersectAlphaWithMask(rgba: Buffer, canvasW: number, canvasH: number, maskNative: Buffer): Promise<Buffer> {
  const { data: rgbaData } = await sharp(rgba).raw().toBuffer({ resolveWithObject: true });
  const { data: maskData } = await sharp(maskNative).greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(rgbaData);
  const n = canvasW * canvasH;
  for (let i = 0; i < n; i++) {
    out[i * 4 + 3] = Math.round((out[i * 4 + 3] * maskData[i]) / 255);
  }
  return sharp(out, { raw: { width: canvasW, height: canvasH, channels: 4 } }).png().toBuffer();
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

  // Sub-problem B: a confident angled-wall quad + a real reference texture
  // means we can skip the AI entirely for this one and warp the real
  // pixels in ourselves — deterministic, exact geometry, no hallucination
  // risk. Any failure here (degenerate quad, bad texture, etc.) falls
  // through to the normal Gemini path below rather than erroring out.
  if (isValidQuad(input.corners) && referenceImage) {
    try {
      const quadPx = input.corners.map((p) => ({ x: p.x * origWidth, y: p.y * origHeight }));
      const originalRotated = await sharp(original).rotate().toBuffer();

      const warped = await warpTextureOntoQuad(referenceImage, origWidth, origHeight, quadPx);
      const shaded = await applyShadingMap(warped, origWidth, origHeight, originalRotated, quadPx);
      const masked = await intersectAlphaWithMask(shaded, origWidth, origHeight, maskNative);

      // NOTE: .ensureAlpha() before .joinChannel() is required here, not
      // .removeAlpha() — sharp silently fails to attach the joined channel
      // (stays at 3 channels, alpha effectively lost) when the base has no
      // alpha channel going in. .ensureAlpha() matches the pattern the
      // existing Gemini-path compositing below already relies on.
      const featherPx = featherPxFor(origWidth, origHeight);
      const alphaOnly = await sharp(masked).extractChannel(3).blur(featherPx).raw().toBuffer();
      const featheredOverlay = await sharp(masked)
        .ensureAlpha()
        .joinChannel(alphaOnly, { raw: { width: origWidth, height: origHeight, channels: 1 } })
        .png()
        .toBuffer();

      const composited = await sharp(originalRotated)
        .resize(origWidth, origHeight, { fit: "fill" })
        .composite([{ input: featheredOverlay, blend: "over" }])
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();

      const dataUri = `data:image/jpeg;base64,${composited.toString("base64")}`;
      const uploaded = await uploadWithRetry(dataUri, { folder: "product-match/home-material/visualizations" });

      return {
        url: uploaded.secure_url,
        width: origWidth,
        height: origHeight,
        bytes: composited.length,
        model: "homography+shading-v1",
        mode: "product_accurate",
        perspectiveCorrected: true,
      };
    } catch (err) {
      console.error("[home-material/visualization] perspective-correct path failed, falling back to AI generation:", err);
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
    perspectiveCorrected: false,
  };
}
