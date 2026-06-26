/**
 * Shared, provider-agnostic product metadata service.
 *
 * Single source of truth for analysing a product image into structured
 * metadata. Every consumer — model generation, and future recommendation /
 * stylist / catalogue-intelligence systems — calls this one service rather than
 * embedding its own extraction. The analysis is performed by a vision model
 * internally, but that is an implementation detail: callers depend only on the
 * ProductMetadata shape.
 *
 * Generated once at upload and persisted on the Product (typed columns +
 * `pattern`); generation reads those columns, so analysis is not re-run.
 */

import { recordAiUsage } from "@/lib/ai-usage/record";

const ANALYZER_MODEL = "gemini-2.5-flash-lite";

/** Cost-attribution context for metadata extraction. All fields optional. */
export interface AnalyzeContext {
  storeId?: string | null;
  userId?: string | null;
  productId?: string | null;
}

export interface ProductMetadata {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  color: string;
  /** Visual pattern/print, e.g. Floral, Paisley, Zari, Solid. */
  pattern: string;
  material: string;
  gender: string;
  occasion: string[];
  styleTags: string[];
  season: string[];
  price: number;
}

export type MetadataResult =
  | { ok: true; metadata: ProductMetadata }
  | { ok: false; status: number; error: string };

/**
 * Build the analysis prompt. When the retailer has already chosen a category, it
 * is asserted as ground truth so the model describes (title/description/etc.)
 * the product AS that category and never reclassifies it — preventing e.g. a
 * saree being mistaken for a dupatta.
 */
function buildAnalysisPrompt(knownCategory?: string): string {
  const cat = knownCategory?.trim();
  const categoryAssertion = cat
    ? `IMPORTANT: This product IS a ${cat}. Treat it as a ${cat} throughout — describe the title and description as a ${cat}, and never reclassify it. Set "category" to exactly "${cat}".`
    : "";
  return `Indian ethnic fashion product image. ${categoryAssertion}
Return raw JSON only, no markdown:
{"title":"","description":"2-3 sentences","category":"Saree|Lehenga|Blouse|Dupatta|Kurta|Salwar|Anarkali|Sharara|Palazzo|Jewellery|Footwear|Clutch|Handbag|Suit|Tie|Other","subcategory":"or empty string","color":"primary color","pattern":"Solid|Floral|Paisley|Geometric|Striped|Polka|Checked|Embroidered|Printed|Woven|Zari|Bandhani|Block Print|Abstract|other","material":"Silk|Cotton|Chiffon|Georgette|Velvet|Banarasi|Kanjeevaram|Linen|Crepe|Net|Satin|Polyester|Organza|Khadi|Wool|Gold|best guess","gender":"WOMEN|MEN|UNISEX|GIRLS|BOYS","occasion":[],"styleTags":[],"season":[],"price":0}
occasion options: Wedding Bridal Festive Party Casual Formal Office Traditional Religious Anniversary
styleTags options: Ethnic Boho Minimalist Traditional Contemporary Fusion Royal Bridal Casual Festive
season options: Spring Summer Autumn Winter All Season
price: integer INR estimate based on quality. Arrays may be empty. Use "Other" for unknown category. "pattern" is the dominant visual print/motif.`;
}

/**
 * Analyse a product image into structured metadata. Never throws — returns a
 * tagged result so route handlers can map failures to HTTP responses.
 */
export async function analyzeProductImage(
  buffer: Buffer,
  mimeType: string,
  context: AnalyzeContext = {},
  /** Retailer-confirmed category — asserted as ground truth, never reclassified. */
  knownCategory?: string
): Promise<MetadataResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { ok: false, status: 503, error: "Metadata analysis is not configured." };
  }

  const t0 = Date.now();
  const usageBase = {
    provider: "gemini",
    model: ANALYZER_MODEL,
    feature: "metadata_extract",
    requestBytes: buffer.length,
    imageInputs: 1,
    storeId: context.storeId ?? null,
    userId: context.userId ?? null,
    productId: context.productId ?? null,
  } as const;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYZER_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
          { text: buildAnalysisPrompt(knownCategory) },
        ],
      },
    ],
    generationConfig: { temperature: 0.2 },
  });

  // Transient failures (rate limits, 5xx, network blips) are common on hosted
  // infra and were falling back to manual entry on the first hiccup. Retry a few
  // times with backoff so a single transient error doesn't fail the auto-fill.
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    } catch {
      res = null;
    }
    if (res && res.ok) break;
    const transient = !res || res.status === 429 || res.status >= 500;
    if (!transient || attempt === 3) break;
    await new Promise((r) => setTimeout(r, 500 * attempt)); // 0.5s, then 1s
  }

  if (!res) {
    void recordAiUsage({
      ...usageBase,
      durationMs: Date.now() - t0,
      status: "error",
      errorMessage: "Could not reach the analysis service.",
    });
    return { ok: false, status: 502, error: "Could not reach the analysis service." };
  }

  if (!res.ok) {
    void recordAiUsage({
      ...usageBase,
      durationMs: Date.now() - t0,
      status: "error",
      errorMessage: `HTTP ${res.status}`,
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 503, error: "Invalid analysis credentials." };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, error: "Rate limit reached. Try again in a moment." };
    }
    return { ok: false, status: 502, error: "Analysis failed. Please fill the form manually." };
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
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) {
    return { ok: false, status: 502, error: "No response from the analysis service." };
  }

  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, status: 502, error: "Analysis returned an unexpected format." };
  }

  const metadata: ProductMetadata = {
    title: String(parsed.title || ""),
    description: String(parsed.description || ""),
    // Retailer-confirmed category wins — never let the model override it.
    category: knownCategory?.trim() || String(parsed.category || "Other"),
    subcategory: String(parsed.subcategory || ""),
    color: String(parsed.color || ""),
    pattern: String(parsed.pattern || ""),
    material: String(parsed.material || ""),
    gender: String(parsed.gender || "WOMEN"),
    occasion: Array.isArray(parsed.occasion) ? parsed.occasion.map(String) : [],
    styleTags: Array.isArray(parsed.styleTags) ? parsed.styleTags.map(String) : [],
    season: Array.isArray(parsed.season) ? parsed.season.map(String) : [],
    price:
      typeof parsed.price === "number"
        ? parsed.price
        : parseFloat(String(parsed.price)) || 0,
  };

  return { ok: true, metadata };
}
