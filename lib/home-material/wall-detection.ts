/**
 * AI wall detection — the Computer Vision boundary from
 * docs/home-material/README.md's AI-boundaries table, pulled forward from
 * "future" into the fast-lane demo scope (2026-09-07 pivot, upgraded to
 * polygon outlines 2026-09-07). Scoped narrowly: a single photo taken
 * standing directly facing a wall ("least complex" case) — NOT general
 * multi-wall/perspective room understanding, which stays future work (see
 * the domain brief's "flagged as shortcut" section for why).
 *
 * Returns a POLYGON outline (not a rectangle) so the selection can hug the
 * wall's real boundary — ceiling/floor/corner lines, door/window edges —
 * instead of a generic axis-aligned box. This is a preview only: the
 * caller shows it as an editable draft (draggable vertices) before the
 * user confirms and it's persisted as an HmSurface.
 *
 * Independently implemented — not a call into lib/garment-intelligence,
 * which is fashion/garment-specific — but the same proven pattern: one
 * generateContent call, image + prompt in, structured JSON out
 * (responseMimeType: "application/json"), never prose. Output is
 * STRUCTURED FACTS ONLY (a polygon + a confidence + explicit "not visible"
 * signal) — this function makes no commercial/recommendation judgment,
 * per the AI-boundaries rule that CV doesn't decide suitability.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-2.5-flash";
const MIN_POINTS = 3;
const MAX_POINTS = 12;

export interface Point {
  x: number;
  y: number;
}

export interface WallDetectionResult {
  wallVisible: boolean;
  confidence: number;
  polygon: Point[] | null;
  notes: string | null;
}

interface RawDetection {
  wallVisible?: unknown;
  confidence?: unknown;
  polygon?: unknown;
  notes?: unknown;
}

function isFraction(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Shoelace formula — rejects a degenerate (near-zero-area) or malformed polygon rather than letting a useless selection through. */
function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Validates the model's raw JSON into a trustworthy result. Never trusts a
 * polygon that's out of bounds, too small, or malformed — Constitution
 * Principle 4 ("never manufacture certainty"): a bad polygon is treated as
 * "not detected," never silently patched into something plausible-looking.
 */
function parseDetection(raw: RawDetection): WallDetectionResult {
  const confidence = typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : 0;
  const notes = typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null;

  const rawPoints = Array.isArray(raw.polygon) ? raw.polygon : null;
  const points: Point[] | null =
    rawPoints &&
    rawPoints.length >= MIN_POINTS &&
    rawPoints.length <= MAX_POINTS &&
    rawPoints.every((p) => p && isFraction(p.x) && isFraction(p.y))
      ? rawPoints.map((p) => ({ x: p.x, y: p.y }))
      : null;

  const validPolygon = points && polygonArea(points) > 0.02;

  if (!raw.wallVisible || !validPolygon) {
    return { wallVisible: false, confidence, polygon: null, notes };
  }

  return { wallVisible: true, confidence, polygon: points, notes };
}

const PROMPT = `You are analyzing a photo of a room, taken by someone standing directly facing a wall, parallel to it (a straight-on shot, not an angled one).

Trace the OUTLINE of the single largest contiguous flat WALL surface suitable for applying wallpaper or paint, as a closed polygon that hugs its real boundary — following the ceiling line, floor line, and side corners where the wall actually ends. Exclude furniture, windows, doors, mirrors, artwork/frames, light switches/outlets, the floor, and the ceiling from the polygon — if one of these interrupts the wall's boundary, route the polygon around it using extra vertices (up to 12 total); if that's impractical, trace the simpler outer boundary and mention the obstruction in notes instead of guessing.

If no clear, mostly-unobstructed wall is visible (e.g. the photo is not a straight-on wall shot), set wallVisible to false and briefly say why in notes — do not guess a polygon.

Respond with ONLY this JSON shape, no other text:
{
  "wallVisible": boolean,
  "confidence": number (0 to 1),
  "polygon": [{ "x": number, "y": number }, ...] | null,
  "notes": string | null
}

Polygon points are fractions of the image (0 to 1, top-left origin), listed in order around the shape (clockwise or counter-clockwise, consistently) — between 3 and 12 points. Omit or null the polygon when wallVisible is false.`;

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
