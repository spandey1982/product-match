/**
 * AI wall detection — the Computer Vision boundary from
 * docs/home-material/README.md's AI-boundaries table, pulled forward from
 * "future" into the fast-lane demo scope (2026-09-07 pivot). Scoped
 * narrowly: a single photo taken standing directly facing a wall
 * ("least complex" case) — NOT general multi-wall/perspective room
 * understanding, which stays future work (see the domain brief's
 * "flagged as shortcut" section for why).
 *
 * Independently implemented — not a call into lib/garment-intelligence,
 * which is fashion/garment-specific — but the same proven pattern: one
 * generateContent call, image + prompt in, structured JSON out
 * (responseMimeType: "application/json"), never prose. Output is
 * STRUCTURED FACTS ONLY (a region + a confidence + explicit "not visible"
 * signal) — this function makes no commercial/recommendation judgment,
 * per the AI-boundaries rule that CV doesn't decide suitability.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-2.5-flash";

export interface WallDetectionResult {
  wallVisible: boolean;
  confidence: number;
  rect: { x: number; y: number; width: number; height: number } | null;
  notes: string | null;
}

interface RawDetection {
  wallVisible?: unknown;
  confidence?: unknown;
  boundingBox?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  notes?: unknown;
}

function isFraction(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

/**
 * Validates the model's raw JSON into a trustworthy result. Never trusts a
 * box that's out of [0,1] bounds or degenerate — Constitution Principle 4
 * ("never manufacture certainty"): a malformed or missing box is treated as
 * "not detected," never silently clamped into something plausible-looking.
 */
function parseDetection(raw: RawDetection): WallDetectionResult {
  const confidence = typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : 0;
  const notes = typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null;

  const box = raw.boundingBox;
  const validBox =
    box &&
    isFraction(box.x) &&
    isFraction(box.y) &&
    isFraction(box.width) &&
    isFraction(box.height) &&
    box.width > 0.05 &&
    box.height > 0.05 &&
    box.x + box.width <= 1.001 &&
    box.y + box.height <= 1.001;

  if (!raw.wallVisible || !validBox) {
    return { wallVisible: false, confidence, rect: null, notes };
  }

  return {
    wallVisible: true,
    confidence,
    rect: {
      x: box!.x as number,
      y: box!.y as number,
      width: Math.min(1 - (box!.x as number), box!.width as number),
      height: Math.min(1 - (box!.y as number), box!.height as number),
    },
    notes,
  };
}

const PROMPT = `You are analyzing a photo of a room, taken by someone standing directly facing a wall, parallel to it (a straight-on shot, not an angled one).

Identify the single largest contiguous flat WALL surface suitable for applying wallpaper or paint. Exclude from the region: furniture, windows, doors, mirrors, artwork/frames, light switches/outlets, the floor, and the ceiling — the region should cover ONLY bare wall surface.

If no clear, mostly-unobstructed wall is visible (e.g. the photo is not a straight-on wall shot, or the wall is mostly hidden by furniture), set wallVisible to false and briefly say why in notes — do not guess a region.

Respond with ONLY this JSON shape, no other text:
{
  "wallVisible": boolean,
  "confidence": number (0 to 1),
  "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null,
  "notes": string | null
}

boundingBox fields are fractions of the image (0 to 1), x/y is the top-left corner. Omit or null the boundingBox when wallVisible is false.`;

export async function detectWallRegion(roomImageUrl: string, hmUserId: string): Promise<WallDetectionResult | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { error: "AI wall detection is not configured." };
  }

  let imageBuffer: Buffer;
  let mime = "image/jpeg";
  try {
    const res = await fetch(roomImageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    imageBuffer = Buffer.from(await res.arrayBuffer());
    mime = res.headers.get("content-type") || mime;
  } catch (err) {
    return { error: `Could not fetch the room photo: ${String(err)}` };
  }

  const t0 = Date.now();
  const requestBytes = imageBuffer.length;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mime, data: imageBuffer.toString("base64") } },
                { text: PROMPT },
              ],
            },
          ],
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
        feature: "hm_wall_detection",
        durationMs,
        requestBytes,
        imageInputs: 1,
        userId: hmUserId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
      });
      return { error: "Wall detection failed. Please try again or select the wall manually." };
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_wall_detection",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs,
      requestBytes,
      imageInputs: 1,
      userId: hmUserId,
      status: "success",
    });

    if (!text) return { error: "Wall detection returned no result. Please select the wall manually." };

    let raw: RawDetection;
    try {
      raw = JSON.parse(text);
    } catch {
      return { error: "Wall detection returned an unreadable result. Please select the wall manually." };
    }

    return parseDetection(raw);
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_wall_detection",
      requestBytes,
      imageInputs: 1,
      userId: hmUserId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
    });
    return { error: "Could not reach the wall detection service." };
  }
}
