/**
 * AI wall detection — the Computer Vision boundary from
 * docs/home-material/README.md's AI-boundaries table, pulled forward from
 * "future" into the fast-lane demo scope (2026-09-07 pivot, upgraded to
 * polygon outlines 2026-09-07, upgraded to multi-wall candidates
 * 2026-09-09 — "lightweight E" from the multi-wall discussion). Still
 * scoped narrowly: a single photo taken standing roughly facing the
 * wall(s) ("least complex" case) — this returns each visible wall as an
 * INDEPENDENT candidate with no perspective-correction and no cross-wall
 * continuity guarantee. Genuine multi-wall geometry (shared corners,
 * angle/perspective correction, pattern continuity across a corner) is
 * explicitly out of scope here — see the domain brief's sub-problems
 * A/B/C, deferred pending a dedicated prototype.
 *
 * Returns POLYGON outlines (not rectangles) so each selection can hug its
 * wall's real boundary — ceiling/floor/corner lines, door/window edges —
 * instead of a generic axis-aligned box. This is a preview only: the
 * caller shows each candidate as an editable draft (draggable vertices)
 * before the user confirms one and it's persisted as an HmSurface.
 *
 * Independently implemented — not a call into lib/garment-intelligence,
 * which is fashion/garment-specific — but the same proven pattern: one
 * generateContent call, image + prompt in, structured JSON out
 * (responseMimeType: "application/json"), never prose. Output is
 * STRUCTURED FACTS ONLY (polygons + confidences + an explicit "not
 * visible" signal) — this function makes no commercial/recommendation
 * judgment, per the AI-boundaries rule that CV doesn't decide suitability.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-2.5-flash";
const MIN_POINTS = 3;
const MAX_POINTS = 12;
const MAX_CANDIDATES = 5;

export interface Point {
  x: number;
  y: number;
}

export interface WallCandidate {
  polygon: Point[];
  confidence: number;
  label: string | null;
}

export interface WallDetectionResult {
  wallVisible: boolean;
  candidates: WallCandidate[];
  notes: string | null;
}

interface RawCandidate {
  confidence?: unknown;
  polygon?: unknown;
  label?: unknown;
}

interface RawDetection {
  wallVisible?: unknown;
  walls?: unknown;
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
 * Validates one raw candidate polygon. Never trusts a polygon that's out
 * of bounds, too small, or malformed — Constitution Principle 4 ("never
 * manufacture certainty"): a bad polygon is dropped, never silently
 * patched into something plausible-looking.
 */
function parseCandidate(raw: RawCandidate): WallCandidate | null {
  const confidence = typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : 0;
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : null;

  const rawPoints = Array.isArray(raw.polygon) ? raw.polygon : null;
  const points: Point[] | null =
    rawPoints &&
    rawPoints.length >= MIN_POINTS &&
    rawPoints.length <= MAX_POINTS &&
    rawPoints.every((p) => p && isFraction(p.x) && isFraction(p.y))
      ? rawPoints.map((p) => ({ x: p.x, y: p.y }))
      : null;

  if (!points || polygonArea(points) <= 0.02) return null;
  return { polygon: points, confidence, label };
}

/**
 * Validates the model's raw JSON into a trustworthy result — a list of
 * independent wall candidates (lightweight multi-wall, 2026-09-09). Each
 * candidate is validated on its own; a malformed candidate is dropped
 * rather than rejecting the whole response.
 */
function parseDetection(raw: RawDetection): WallDetectionResult {
  const notes = typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null;
  const rawWalls = Array.isArray(raw.walls) ? raw.walls : [];
  const candidates = rawWalls
    .map((w) => parseCandidate(w as RawCandidate))
    .filter((c): c is WallCandidate => c !== null)
    .slice(0, MAX_CANDIDATES);

  if (!raw.wallVisible || candidates.length === 0) {
    return { wallVisible: false, candidates: [], notes };
  }

  return { wallVisible: true, candidates, notes };
}

const PROMPT = `You are analyzing a photo of a room, taken by someone standing roughly facing the wall(s) they want to redecorate.

Identify EVERY distinct, mostly-unobstructed flat WALL surface suitable for applying wallpaper or paint — there may be just one, or several (e.g. two walls meeting at a corner, both visible in the shot). For EACH wall, trace its OUTLINE as a closed polygon that hugs its real boundary — following the ceiling line, floor line, and corners where the wall actually ends. Exclude furniture, windows, doors, mirrors, artwork/frames, light switches/outlets, the floor, and the ceiling from each polygon — if one of these interrupts a wall's boundary, route the polygon around it using extra vertices (up to 12 total per wall); if that's impractical, trace the simpler outer boundary and mention the obstruction in notes instead of guessing.

Treat each wall as an INDEPENDENT region — do not attempt to correct for perspective or align polygons precisely at a shared corner; a rough, honest outline per wall is enough.

If no clear, mostly-unobstructed wall is visible at all, set wallVisible to false, return an empty walls array, and briefly say why in notes — do not guess a polygon.

Respond with ONLY this JSON shape, no other text:
{
  "wallVisible": boolean,
  "walls": [
    {
      "confidence": number (0 to 1),
      "label": string | null (a short human label if it's obvious, e.g. "left wall", "back wall" — null if not obvious),
      "polygon": [{ "x": number, "y": number }, ...]
    }
  ],
  "notes": string | null
}

Polygon points are fractions of the image (0 to 1, top-left origin), listed in order around the shape (clockwise or counter-clockwise, consistently) — between 3 and 12 points per wall. Return up to 5 walls, ordered largest/most prominent first. Return an empty "walls" array when wallVisible is false.`;

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
