/**
 * AI-suggested wall adjacency — sub-problem A from the 2026-09-09 multi-wall
 * discussion, built 2026-09-10 after a dedicated scoping conversation.
 *
 * Deliberately SUGGEST-ONLY: this never writes HmSurface.adjacencyGroupId
 * itself. It returns candidate groupings for the existing manual
 * AdjacencyMarker UI (app/api/home-material/rooms/[roomId]/surfaces/
 * adjacency/route.ts) to pre-fill as checked boxes — the user still clicks
 * "Mark selected as adjacent" to persist anything. This mirrors the
 * established pattern elsewhere in this domain (wall-detection candidates,
 * G's alternative-product suggestions): AI proposes, a human confirms
 * anything that becomes a stored fact. Constitution Principle 4 ("never
 * manufacture certainty") applies here too — a wall pair the model isn't
 * confident about is left ungrouped, not force-grouped.
 *
 * Reuses the same "bake a visible marker onto the photo" technique proven
 * in visualization.ts's renderOutlinedBase / scale-estimation.ts's
 * renderOutlinedPhoto, extended to multiple distinctly-colored, lettered
 * outlines in one image so the model can reason about which labeled walls
 * share a real physical corner.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";
import sharp from "sharp";

const MODEL_ID = "gemini-2.5-flash";
const MAX_WALLS = 8;
const OUTLINE_COLORS = ["#ff00ff", "#00e5ff", "#ffd400", "#00e676", "#ff6d00", "#d500f9", "#2979ff", "#ff1744"];

export interface Point {
  x: number;
  y: number;
}

export interface WallForAdjacencyCheck {
  id: string;
  polygon: Point[];
}

export interface AdjacencyGroupSuggestion {
  wallIds: string[];
  confidence: number;
  reason: string;
}

export interface AdjacencyDetectionResult {
  groups: AdjacencyGroupSuggestion[];
  notes: string | null;
}

interface RawGroup {
  wallLabels?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

interface RawResult {
  groups?: unknown;
  notes?: unknown;
}

function letterFor(index: number): string {
  return String.fromCharCode(65 + index);
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Bakes one distinctly-colored, lettered outline per wall onto the same photo. */
async function renderLabeledOutlines(baseBuf: Buffer, walls: WallForAdjacencyCheck[], width: number, height: number): Promise<Buffer> {
  const strokeWidth = Math.max(4, Math.round(Math.min(width, height) * 0.01));
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.045));
  const parts = walls.map((wall, i) => {
    const color = OUTLINE_COLORS[i % OUTLINE_COLORS.length];
    const pointsAttr = wall.polygon.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(" ");
    const cx = wall.polygon.reduce((s, p) => s + p.x, 0) / wall.polygon.length;
    const cy = wall.polygon.reduce((s, p) => s + p.y, 0) / wall.polygon.length;
    const label = letterFor(i);
    return `<polygon points="${pointsAttr}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>
      <circle cx="${(cx * width).toFixed(1)}" cy="${(cy * height).toFixed(1)}" r="${fontSize * 0.7}" fill="${color}"/>
      <text x="${(cx * width).toFixed(1)}" y="${(cy * height).toFixed(1)}" font-size="${fontSize}" font-family="sans-serif" font-weight="bold" fill="#000000" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  });
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("\n")}</svg>`;
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(baseBuf).composite([{ input: overlay, blend: "over" }]).jpeg({ quality: 90 }).toBuffer();
}

function buildPrompt(letters: string[]): string {
  return `This photo shows a room with ${letters.length} wall regions, each outlined in a distinct color and marked with a letter (${letters.join(", ")}).

Judge which of these labeled walls are physically ADJACENT — meaning they are two real, separate wall surfaces that meet at a shared vertical corner in the actual room (so wallpaper/paint applied across both would visually continue around that corner). Look for real evidence: a visible corner line or shadow between two labeled regions, a ceiling or floor line that continues unbroken from one into the other, or the two outlines sharing an edge in the photo.

Do NOT group two labels just because they're both walls, or both selected — only group them if you can see they share a real physical corner. If you are not confident two walls are adjacent, leave them in separate groups (or ungrouped) — never guess. A wall can belong to at most one group. A wall with no adjacent partner should simply not appear in any group.

Respond with ONLY this JSON shape, no other text:
{
  "groups": [
    { "wallLabels": ["A", "B"], "confidence": number (0 to 1), "reason": string (brief, cite the visual evidence) }
  ],
  "notes": string | null
}

Return an empty "groups" array if no walls are confidently adjacent.`;
}

function parseResult(raw: RawResult, letters: string[], idByLetter: Map<string, string>): AdjacencyDetectionResult {
  const notes = typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null;
  const rawGroups = Array.isArray(raw.groups) ? raw.groups : [];
  const seen = new Set<string>();
  const groups: AdjacencyGroupSuggestion[] = [];

  for (const g of rawGroups as RawGroup[]) {
    const rawLabels = Array.isArray(g.wallLabels) ? g.wallLabels : [];
    const labels = rawLabels.filter((l): l is string => typeof l === "string" && letters.includes(l));
    const uniqueLabels = [...new Set(labels)];
    if (uniqueLabels.length < 2) continue;
    // A wall confidently claimed by an earlier (higher-priority) group is not double-counted.
    const ids = uniqueLabels.filter((l) => !seen.has(l)).map((l) => idByLetter.get(l)!);
    if (ids.length < 2) continue;
    uniqueLabels.forEach((l) => seen.add(l));

    const confidence = typeof g.confidence === "number" && g.confidence >= 0 && g.confidence <= 1 ? g.confidence : 0;
    const reason = typeof g.reason === "string" && g.reason.trim() ? g.reason.trim() : "No reason given.";
    groups.push({ wallIds: ids, confidence, reason });
  }

  return { groups, notes };
}

export async function detectAdjacentWalls(
  roomImageUrl: string,
  walls: WallForAdjacencyCheck[],
  hmUserId: string
): Promise<AdjacencyDetectionResult | { error: string }> {
  if (walls.length < 2) return { groups: [], notes: "Fewer than two walls to compare." };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { error: "Adjacency suggestion is not configured." };
  }

  const clipped = walls.slice(0, MAX_WALLS);
  const letters = clipped.map((_, i) => letterFor(i));
  const idByLetter = new Map(clipped.map((w, i) => [letterFor(i), w.id]));

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
  const outlined = await renderLabeledOutlines(rotated, clipped, width, height);
  const requestBytes = outlined.length;
  const t0 = Date.now();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: outlined.toString("base64") } }, { text: buildPrompt(letters) }] }],
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
        feature: "hm_adjacency_detection",
        durationMs,
        requestBytes,
        imageInputs: 1,
        userId: hmUserId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
      });
      return { error: "Could not suggest adjacency. Please mark walls manually." };
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_adjacency_detection",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs,
      requestBytes,
      imageInputs: 1,
      userId: hmUserId,
      status: "success",
    });

    if (!text) return { groups: [], notes: "No result returned." };

    let raw: RawResult;
    try {
      raw = JSON.parse(text);
    } catch {
      return { groups: [], notes: "Unreadable result." };
    }

    return parseResult(raw, letters, idByLetter);
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_adjacency_detection",
      requestBytes,
      imageInputs: 1,
      userId: hmUserId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
    });
    return { error: "Could not reach the adjacency suggestion service." };
  }
}
