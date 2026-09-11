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
  /**
   * Sheet-size-aware true-scale rendering (2026-09-09) — only takes effect
   * when ALL of: patternType is "repeat_sheet", sheetWidthM/sheetHeightM
   * (the product's real sheet size) AND wallWidthM/wallHeightM (the
   * wall's real size — user-entered or reference-object-estimated) are
   * known, corners is absent (straight-on walls only for this pass —
   * combining true-scale tiling with perspective correction is deferred),
   * and a real referenceImageUrl exists. The reference image is assumed
   * to depict exactly one full sheet (sheetWidthM x sheetHeightM) — a
   * deliberate, documented simplification rather than tracking a
   * separate "what area does this specific photo show" dimension.
   * Missing any of these silently falls back to today's behavior
   * (Gemini full-image edit, stretched to fit) — never blocks anything.
   */
  patternType?: string | null;
  sheetWidthM?: number | null;
  sheetHeightM?: number | null;
  wallWidthM?: number | null;
  wallHeightM?: number | null;
  /**
   * Sub-problem C, cross-wall pattern continuity (2026-09-10) — only
   * meaningful together with the true-scale tiling fields above. The
   * combined real-world width (meters) of every OTHER wall in this wall's
   * adjacencyGroupId that sits before it in the group's inferred
   * left-to-right order (0 for the first/only wall in a run, or when this
   * wall isn't in any adjacency group). Used to phase-shift the tile grid
   * so the pattern appears to continue unbroken from the previous wall
   * rather than restarting at zero on every wall — the same physical
   * continuity the sheet-count math already assumes for adjacent runs.
   * Missing/null behaves exactly like today (phase starts at zero).
   */
  adjacencyOffsetM?: number | null;
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
  /** True when this used the deterministic true-scale tiled-pattern path (2026-09-09) — the repeat-pattern rendered at its real physical size, not stretched to fit. */
  trueScaleRendered: boolean;
  /** True when the tile grid was phase-shifted to continue an adjacent wall's pattern (sub-problem C, 2026-09-10) — meaningless unless trueScaleRendered is also true. */
  adjacencyContinuityApplied: boolean;
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
    `You are editing a photo of a room. The photo has a bright magenta outline drawn on it marking exactly one wall region — change the appearance of ONLY the area enclosed by that magenta outline to show this wall material. A second black-and-white image is also provided as a mask (white = that same region, black = leave untouched) confirming the exact boundary. Do not change any other wall in the photo, even if it looks more prominent or more like a "main" wall — the magenta-outlined region is the one to change, and only that one. The magenta outline itself is only a location marker: do not include it, or any trace of its colour, in your output — render the material's own true edge at that boundary instead.`
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

const COVERAGE_SAMPLE_EDGE = 300;
const COVERAGE_CHANGE_THRESHOLD = 12; // out of 255 — catches a real material change, ignores lighting/JPEG noise

/**
 * Coarse "did the edit actually cover the masked region" check (2026-09-09)
 * — live-testing showed Gemini's adherence to filling a thin or
 * irregularly-shaped mask varies between calls on IDENTICAL inputs,
 * sometimes leaving part of the selected wall untouched. This compares
 * the edited candidate against the original, greyscale and downscaled for
 * speed, counting what fraction of pixels INSIDE the mask actually
 * changed — used to decide whether a retry is worth it, not to judge
 * visual quality.
 */
async function estimateMaskCoverage(
  originalBuf: Buffer,
  editedNativeBuf: Buffer,
  maskNative: Buffer,
  width: number,
  height: number
): Promise<number> {
  const scale = Math.min(1, COVERAGE_SAMPLE_EDGE / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));

  const [orig, edited, mask] = await Promise.all([
    sharp(originalBuf).rotate().resize(sw, sh, { fit: "fill" }).greyscale().raw().toBuffer(),
    sharp(editedNativeBuf).resize(sw, sh, { fit: "fill" }).greyscale().raw().toBuffer(),
    sharp(maskNative).resize(sw, sh, { fit: "fill" }).greyscale().raw().toBuffer(),
  ]);

  let maskedPixels = 0;
  let changedPixels = 0;
  const n = sw * sh;
  for (let i = 0; i < n; i++) {
    if (mask[i] < 128) continue;
    maskedPixels++;
    if (Math.abs(orig[i] - edited[i]) >= COVERAGE_CHANGE_THRESHOLD) changedPixels++;
  }
  return maskedPixels === 0 ? 0 : changedPixels / maskedPixels;
}

/** Renders an arbitrary polygon as a white-on-black mask at the given pixel size — the SVG is rasterized by sharp, so this supports any shape, not just an axis-aligned rect. */
async function renderPolygonMask(points: Point[], width: number, height: number): Promise<Buffer> {
  const pointsAttr = points.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(" ");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="black"/><polygon points="${pointsAttr}" fill="white"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Bakes a bright, unambiguous outline directly onto the photo sent to
 * Gemini, in addition to the separate black/white mask — a real bug
 * found via live-testing on a large real multi-wall photo (2026-09-09):
 * Gemini sometimes doesn't correlate a SEPARATE mask image with the
 * correct region of a busy, real photo and instead edits whichever wall
 * it considers "the main one," ignoring the mask entirely. A visible
 * marker baked into the SAME image the model looks at is far harder to
 * misinterpret. This does not weaken the safety guarantee: the final
 * composite still only takes pixels from within the real (unannotated)
 * mask, regardless of how well Gemini honors this outline.
 */
async function renderOutlinedBase(baseBuf: Buffer, points: Point[], width: number, height: number): Promise<Buffer> {
  const pointsAttr = points.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(" ");
  const strokeWidth = Math.max(4, Math.round(Math.min(width, height) * 0.012));
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pointsAttr}" fill="none" stroke="#ff00ff" stroke-width="${strokeWidth}"/></svg>`;
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(baseBuf).composite([{ input: overlay, blend: "over" }]).jpeg({ quality: 90 }).toBuffer();
}

// ---------- sub-problem B: homography (perspective/angle-correct projection) ----------
// Validated in an isolated prototype (scratchpad script, not this file)
// before being wired in here — see docs/home-material/README.md.

/** 4 points expected, in TL/TR/BR/BL order — a plain array is used (not a tuple type) to match what wall-detection.ts already validates and hands over. */
function isValidQuad(corners: Point[] | null | undefined): corners is Point[] {
  if (!corners || corners.length !== 4) return false;
  return polygonAreaGeneric(corners) > 0.01;
}

function isPositiveFiniteNum(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
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

// ---------- true-scale tiled rendering (2026-09-09) ----------
// Straight-on walls only for this pass — see QuickPreviewInput's doc
// comment for why perspective+tiling isn't combined yet.

/** Fractional polygon's pixel bounding box at native resolution. */
function polygonBoundingBoxPx(points: Point[], width: number, height: number) {
  const xs = points.map((p) => p.x * width);
  const ys = points.map((p) => p.y * height);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const right = Math.min(width, Math.ceil(Math.max(...xs)));
  const bottom = Math.min(height, Math.ceil(Math.max(...ys)));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/**
 * Repeats a single tile across a canvas of the given size — a plain 2D
 * grid fill (sharp composites one entry per cell), not a novel technique
 * like the homography warp; this is why true-scale tiling didn't need
 * an isolated prototype phase the way sub-problem B did.
 *
 * `offsetXPx` (sub-problem C, 2026-09-10) phase-shifts the grid so it
 * continues an adjacent wall's pattern instead of always restarting at
 * column 0 — built by rendering onto a canvas padded wider by the
 * offset, then cropping the padding away, rather than compositing tiles
 * at a negative `left` (sharp's composite offsets are always
 * non-negative in practice; padding+crop sidesteps that entirely).
 */
async function renderTiledPattern(
  tileBuf: Buffer,
  tileWidthPx: number,
  tileHeightPx: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  offsetXPx = 0
): Promise<Buffer> {
  const tile = await sharp(tileBuf).resize(tileWidthPx, tileHeightPx, { fit: "fill" }).ensureAlpha().png().toBuffer();
  const normalizedOffset = ((offsetXPx % tileWidthPx) + tileWidthPx) % tileWidthPx;
  const paddedWidth = canvasWidthPx + normalizedOffset;
  const cols = Math.ceil(paddedWidth / tileWidthPx);
  const rows = Math.ceil(canvasHeightPx / tileHeightPx);

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      composites.push({ input: tile, left: col * tileWidthPx, top: row * tileHeightPx });
    }
  }

  const padded = await sharp({ create: { width: paddedWidth, height: canvasHeightPx, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();

  if (normalizedOffset === 0) return padded;
  return sharp(padded).extract({ left: Math.round(normalizedOffset), top: 0, width: canvasWidthPx, height: canvasHeightPx }).png().toBuffer();
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
        trueScaleRendered: false,
        adjacencyContinuityApplied: false,
      };
    } catch (err) {
      console.error("[home-material/visualization] perspective-correct path failed, falling back to AI generation:", err);
    }
  }

  // True-scale tiled rendering (2026-09-09) — repeat_sheet materials
  // only, straight-on walls only (no corners — see QuickPreviewInput's
  // doc comment on why tiling isn't combined with perspective correction
  // yet), and only when both the wall's and the product's real
  // dimensions are known. Falls through to the Gemini path otherwise —
  // never blocks a preview for lack of this data.
  if (
    !isValidQuad(input.corners) &&
    input.patternType === "repeat_sheet" &&
    isPositiveFiniteNum(input.sheetWidthM) &&
    isPositiveFiniteNum(input.sheetHeightM) &&
    isPositiveFiniteNum(input.wallWidthM) &&
    isPositiveFiniteNum(input.wallHeightM) &&
    referenceImage
  ) {
    try {
      const originalRotated = await sharp(original).rotate().toBuffer();
      const bbox = polygonBoundingBoxPx(input.points, origWidth, origHeight);

      const pxPerMeterX = bbox.width / input.wallWidthM;
      const pxPerMeterY = bbox.height / input.wallHeightM;
      const tileWidthPx = Math.max(1, Math.round(input.sheetWidthM * pxPerMeterX));
      const tileHeightPx = Math.max(1, Math.round(input.sheetHeightM * pxPerMeterY));

      const hasAdjacencyOffset = typeof input.adjacencyOffsetM === "number" && Number.isFinite(input.adjacencyOffsetM) && input.adjacencyOffsetM > 0;
      const offsetXPx = hasAdjacencyOffset ? input.adjacencyOffsetM! * pxPerMeterX : 0;

      const tiledAtBbox = await renderTiledPattern(referenceImage, tileWidthPx, tileHeightPx, bbox.width, bbox.height, offsetXPx);

      // Paste the tiled fill (sized to the bbox) at its correct offset
      // into a full-canvas transparent layer, then reuse the same
      // masking/shading/feathering as the other deterministic path — the
      // outline polygon still governs the true visible shape (routes
      // around obstructions the same way); tiling only supplies what's
      // INSIDE it.
      const fullCanvas = await sharp({
        create: { width: origWidth, height: origHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: tiledAtBbox, left: bbox.left, top: bbox.top }])
        .png()
        .toBuffer();

      const bboxQuad: Point[] = [
        { x: bbox.left, y: bbox.top },
        { x: bbox.left + bbox.width, y: bbox.top },
        { x: bbox.left + bbox.width, y: bbox.top + bbox.height },
        { x: bbox.left, y: bbox.top + bbox.height },
      ];
      const shaded = await applyShadingMap(fullCanvas, origWidth, origHeight, originalRotated, bboxQuad);
      const masked = await intersectAlphaWithMask(shaded, origWidth, origHeight, maskNative);

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
        model: "tiled-true-scale-v1",
        mode: "product_accurate",
        perspectiveCorrected: false,
        trueScaleRendered: true,
        adjacencyContinuityApplied: hasAdjacencyOffset,
      };
    } catch (err) {
      console.error("[home-material/visualization] true-scale tiling path failed, falling back to AI generation:", err);
    }
  }

  const prompt = buildQuickPreviewPrompt(input.swatch, Boolean(referenceImage));
  const aspectRatio = nearestAspectRatio(modelWidth, modelHeight);

  // The primary image Gemini sees has the target wall outlined directly
  // on it (see renderOutlinedBase's doc comment) — the separate B/W mask
  // is still sent too, as a reinforcing second signal, but is no longer
  // the ONLY way the model learns which region to edit.
  const outlinedBase = await renderOutlinedBase(modelBase, input.points, modelWidth, modelHeight);

  const parts: Array<Record<string, unknown>> = [
    { inline_data: { mime_type: "image/jpeg", data: outlinedBase.toString("base64") } },
    { inline_data: { mime_type: "image/png", data: modelMask.toString("base64") } },
  ];
  if (referenceImage) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: referenceImage.toString("base64") } });
  }
  parts.push({ text: prompt });

  const imageInputs = 2 + (referenceImage ? 1 : 0);
  const requestBytes = outlinedBase.length + modelMask.length + (referenceImage?.length ?? 0);

  // Retry-on-undercoverage (2026-09-09): even with the outlined base and
  // explicit prompt instructions, Gemini's adherence to filling a thin or
  // irregularly-shaped masked region is genuinely non-deterministic —
  // live-testing showed the SAME inputs succeed on one call and leave a
  // visible gap on another. Rather than pretend one prompt tweak can
  // guarantee full coverage, this retries once and keeps whichever
  // attempt actually covered more of the masked region — a reliability
  // mitigation, not a claim of a deterministic fix.
  const MAX_ATTEMPTS = 2;
  const MIN_ACCEPTABLE_COVERAGE = 0.5; // stop retrying early once an attempt clears this
  const MIN_USABLE_COVERAGE = 0.15; // below this even after retrying, honest failure beats a near-blank "success"

  let bestEditedResized: Buffer | null = null;
  let bestCoverage = -1;
  let bestResponseBytes = 0;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
      lastError = "Could not reach the image generation service.";
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
        metadata: { visualizationId: input.visualizationId, attempt },
      });
      continue;
    }
    const generationMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      lastError = "Generation failed. Please try again.";
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
        metadata: { visualizationId: input.visualizationId, attempt },
      });
      continue;
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
      lastError = "The AI did not return an image. Please try again.";
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
        metadata: { visualizationId: input.visualizationId, attempt },
      });
      continue;
    }

    const editedRaw = Buffer.from(imagePart.inlineData!.data, "base64");
    const editedResizedAttempt = await sharp(editedRaw).resize(origWidth, origHeight, { fit: "fill" }).toBuffer();
    const coverage = await estimateMaskCoverage(original, editedResizedAttempt, maskNative, origWidth, origHeight);

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
      metadata: { visualizationId: input.visualizationId, attempt, coverage },
    });

    // Opt-in diagnostic dump (unset in normal operation, zero cost/behavior
    // change) — set HM_DEBUG_DIR to a local directory to inspect exactly
    // what Gemini saw and returned per attempt. Proved genuinely useful
    // for diagnosing both the wrong-wall and undercoverage bugs, 2026-09-09.
    if (process.env.HM_DEBUG_DIR) {
      const fs = await import("fs");
      const dir = process.env.HM_DEBUG_DIR;
      await fs.promises.writeFile(`${dir}/debug-editedRaw-${input.visualizationId}-attempt${attempt}.png`, editedRaw);
      await fs.promises.writeFile(`${dir}/debug-outlinedBase-${input.visualizationId}.jpg`, outlinedBase);
    }

    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      bestEditedResized = editedResizedAttempt;
      bestResponseBytes = editedRaw.length;
    }
    if (coverage >= MIN_ACCEPTABLE_COVERAGE) break;
  }

  if (!bestEditedResized) {
    return { error: lastError ?? "Generation failed. Please try again." };
  }

  // Never manufacture a "success" out of an edit that barely touched the
  // wall (Constitution Principle 4) — even after retrying, this can still
  // come back this low for a genuinely hard shape. Honest failure beats
  // silently uploading a result that looks like nothing happened.
  if (bestCoverage < MIN_USABLE_COVERAGE) {
    return {
      error:
        "The AI couldn't clearly apply the material to this wall shape after a couple of tries — try a simpler wall selection, or try again.",
    };
  }

  // Composite: paste the best attempt's full-image candidate (already
  // resized to native resolution) through a feathered version of the
  // native-resolution mask onto the untouched original — this is what
  // actually enforces "only the selected wall changed," not the prompt
  // instruction alone.
  const editedResized = bestEditedResized;
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

  // The Gemini generation itself (each attempt) is already logged inside
  // the retry loop above — this only needs to cover the upload step,
  // which happens once regardless of how many attempts it took.
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
      imagesGenerated: 1,
      imageInputs,
      requestBytes,
      responseBytes: bestResponseBytes,
      userId: input.hmUserId,
      status: "error",
      errorMessage: `cloudinary_upload: ${String(err)}`,
      metadata: { visualizationId: input.visualizationId, bestCoverage },
    });
    return { error: "Image storage is temporarily unreachable. The generation succeeded but wasn't saved — please try again." };
  }

  return {
    url: uploaded.secure_url,
    width: origWidth,
    height: origHeight,
    bytes: composited.length,
    model: MODEL_ID,
    mode: referenceImage ? "product_accurate" : "quick_preview",
    perspectiveCorrected: false,
    trueScaleRendered: false,
    adjacencyContinuityApplied: false,
  };
}
