/**
 * Estimates a wall's real-world width/height from a common reference
 * object of known typical size visible in the photo (a door, wardrobe,
 * bed, sofa, chair) — the same technique real-world AR measurement apps
 * use, applied here as a fallback for repeat-pattern sheet-goods
 * rendering/sheet-count when the user hasn't manually entered the
 * wall's real dimensions (2026-09-09, part of the wallpaper sheet-size
 * scaling work).
 *
 * Deliberately conservative (Constitution Principle 4, "never
 * manufacture certainty"): if no reference object is clearly
 * identifiable, this returns `unavailable` rather than guessing a
 * plausible-looking number — the caller falls back to prompting the
 * user for a manual dimension instead.
 *
 * Reuses the same "bake a visible marker onto the photo" technique
 * proven in lib/home-material/visualization.ts's renderOutlinedBase —
 * the wall in question is outlined in magenta so the model is pointed at
 * exactly the right region rather than guessing which wall is meant.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";
import sharp from "sharp";

const MODEL_ID = "gemini-2.5-flash";

export interface Point {
  x: number;
  y: number;
}

export interface WallScaleEstimate {
  widthM: number;
  heightM: number;
  confidence: number;
  referenceObjectDescription: string;
}

interface RawEstimate {
  referenceObjectFound?: unknown;
  referenceObjectDescription?: unknown;
  widthM?: unknown;
  heightM?: unknown;
  confidence?: unknown;
  notes?: unknown;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Same outline technique as visualization.ts's renderOutlinedBase — points the model at exactly the wall in question. */
async function renderOutlinedPhoto(baseBuf: Buffer, points: Point[], width: number, height: number): Promise<Buffer> {
  const pointsAttr = points.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(" ");
  const strokeWidth = Math.max(4, Math.round(Math.min(width, height) * 0.012));
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pointsAttr}" fill="none" stroke="#ff00ff" stroke-width="${strokeWidth}"/></svg>`;
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(baseBuf).composite([{ input: overlay, blend: "over" }]).jpeg({ quality: 90 }).toBuffer();
}

const PROMPT = `You are estimating the REAL-WORLD physical size of a specific wall, outlined in bright magenta in this photo.

Look for a common object of a well-known, fairly consistent real-world size visible in the photo — a standard door (~2.0-2.1m tall), a wardrobe/almirah (~1.8-2.2m tall), a bed (a queen/double bed is roughly 1.5m x 2.0m, a single bed roughly 0.9m x 1.9m), a sofa (~0.8-0.9m tall including backrest), a dining chair (~0.9m tall). If one is clearly visible and identifiable, use its typical real-world size to calibrate the photo's scale, then estimate the outlined wall's real width and height in meters.

Be honest about uncertainty: if no such reference object is clearly visible, or you can't confidently tell which specific object it is (so its typical size is a guess itself), set referenceObjectFound to false and leave widthM/heightM null — do not estimate dimensions without a real calibration reference.

Respond with ONLY this JSON shape, no other text:
{
  "referenceObjectFound": boolean,
  "referenceObjectDescription": string | null (e.g. "a wardrobe, typically about 2m tall" — null if not found),
  "widthM": number | null,
  "heightM": number | null,
  "confidence": number (0 to 1),
  "notes": string | null
}`;

export async function estimateWallDimensions(
  roomImageUrl: string,
  polygon: Point[],
  hmUserId: string
): Promise<WallScaleEstimate | { unavailable: true; reason: string } | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { error: "Scale estimation is not configured." };
  }

  let original: Buffer;
  let width = 0;
  let height = 0;
  try {
    original = await fetchImageBuffer(roomImageUrl);
    const meta = await sharp(original).rotate().metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    if (width <= 0 || height <= 0) throw new Error("Could not read image dimensions");
  } catch (err) {
    return { error: `Could not read the room photo: ${String(err)}` };
  }

  const rotated = await sharp(original).rotate().toBuffer();
  const outlined = await renderOutlinedPhoto(rotated, polygon, width, height);
  const requestBytes = outlined.length;
  const t0 = Date.now();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: outlined.toString("base64") } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      void recordAiUsage({
        provider: "gemini",
        model: MODEL_ID,
        feature: "hm_scale_estimation",
        durationMs,
        requestBytes,
        imageInputs: 1,
        userId: hmUserId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
      });
      return { error: "Could not estimate the wall's real size." };
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_scale_estimation",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs,
      requestBytes,
      imageInputs: 1,
      userId: hmUserId,
      status: "success",
    });

    if (!text) return { unavailable: true, reason: "No result returned." };

    let raw: RawEstimate;
    try {
      raw = JSON.parse(text);
    } catch {
      return { unavailable: true, reason: "Unreadable result." };
    }

    const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
    if (
      raw.referenceObjectFound !== true ||
      !isPositiveFinite(raw.widthM) ||
      !isPositiveFinite(raw.heightM) ||
      typeof raw.referenceObjectDescription !== "string" ||
      !raw.referenceObjectDescription.trim()
    ) {
      return { unavailable: true, reason: notes || "No usable reference object found." };
    }

    const confidence = typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : 0.5;

    return {
      widthM: raw.widthM,
      heightM: raw.heightM,
      confidence,
      referenceObjectDescription: raw.referenceObjectDescription.trim(),
    };
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_scale_estimation",
      requestBytes,
      imageInputs: 1,
      userId: hmUserId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
    });
    return { error: "Could not reach the scale estimation service." };
  }
}
