/**
 * Generation detail-notes extractor (prompt enrichment v1).
 *
 * Produces a concise, category-aware descriptor of the visually critical
 * specifics a product photo must preserve — weave/technique, dominant motif,
 * border/edge treatment, embellishment, texture — and feeds it into the
 * generation prompt so fine detail survives synthesis.
 *
 * Lazy + cached: computed once per product (stored on Product.detailNotes) and
 * reused on every later generation. Uses the retailer's CONFIRMED category
 * (never an AI guess) so the description is grounded. One cheap Flash-lite call,
 * one-time. Non-fatal — any failure returns null and generation proceeds.
 */
import { db } from "@/lib/db";
import { recordAiUsage } from "@/lib/ai-usage/record";
import { fetchProductImageBuffer } from "@/lib/generate-model-image";

const MODEL = "gemini-2.5-flash-lite";

function buildExtractionPrompt(category: string): string {
  return [
    `This is a ${category} (Indian ethnic fashion product).`,
    "In ONE concise line, list ONLY the visually critical details a photographer must preserve:",
    "fabric/weave or technique, dominant motif/pattern, border or edge treatment, embellishment",
    "(zari, embroidery, sequins, mirror, etc.), and notable texture.",
    "Comma-separated phrases, no full sentences, max ~25 words. Omit any detail that isn't clearly visible.",
  ].join(" ");
}

export interface DetailNotesContext {
  storeId?: string | null;
  userId?: string | null;
}

/**
 * Return the product's cached detailNotes, extracting + persisting them first if
 * absent. Returns null when unavailable (no key, no image, or extraction failed).
 */
export async function ensureDetailNotes(
  productId: string,
  imageUrl: string,
  category: string,
  ctx: DetailNotesContext = {}
): Promise<string | null> {
  const existing = await db.product.findUnique({
    where: { id: productId },
    select: { detailNotes: true },
  });
  if (existing?.detailNotes) return existing.detailNotes;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return null;

  const source = await fetchProductImageBuffer(imageUrl);
  if (!source) return null;

  const t0 = Date.now();
  const usageBase = {
    provider: "gemini",
    model: MODEL,
    feature: "detail_extract",
    requestBytes: source.buffer.length,
    imageInputs: 1,
    storeId: ctx.storeId ?? null,
    userId: ctx.userId ?? null,
    productId,
  } as const;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: source.mime, data: source.buffer.toString("base64") } },
                { text: buildExtractionPrompt(category) },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!res.ok) {
      void recordAiUsage({ ...usageBase, durationMs: Date.now() - t0, status: "error", errorMessage: `HTTP ${res.status}` });
      return null;
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    void recordAiUsage({
      ...usageBase,
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs: Date.now() - t0,
      status: "success",
    });

    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    if (!text) return null;

    await db.product.update({ where: { id: productId }, data: { detailNotes: text } });
    return text;
  } catch (err) {
    console.error("[detail-notes] extraction failed:", err);
    return null;
  }
}
