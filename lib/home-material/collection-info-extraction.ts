/**
 * Collection-level info extraction (2026-09-17) — the second enrichment
 * source from the same follow-up as pdf-classification.ts. Some supplier
 * PDFs include a genuine material/technology reference page (construction
 * layers, eco-friendly claims, etc.) that applies to every product in that
 * collection, not any single one — today that text just sits in an
 * HmCatalogueImportPage row tagged pageType "info" with nothing done with
 * it, meaning a reviewer would otherwise have to manually retype the same
 * facts into every sibling product's form. This runs ONCE per import
 * (not per page) over the combined text of every "info" page, and only
 * ever extracts facts explicitly present in that text — never invents,
 * matching this domain's "absence is information" discipline
 * (PROJECT_KNOWLEDGE.md / lib/home-material/wall-detection.ts's same
 * rule). The result is a suggestion surfaced in the review queue for the
 * admin to apply to some or all pending candidates — never written to a
 * product automatically.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-2.5-flash";

export interface CollectionInfoFields {
  materialComposition: string | null;
  installationMethod: string | null; // "peel_and_stick" | "paste_the_wall" | "paste_the_paper" | "professional" | null
  warrantyInfo: string | null;
  description: string | null;
  claims: string[];
}

const INSTALLATION_METHODS = new Set(["peel_and_stick", "paste_the_wall", "paste_the_paper", "professional"]);

function isValidFields(x: unknown): x is CollectionInfoFields {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.materialComposition !== null && typeof o.materialComposition !== "string") return false;
  if (o.installationMethod !== null && !INSTALLATION_METHODS.has(o.installationMethod as string)) return false;
  if (o.warrantyInfo !== null && typeof o.warrantyInfo !== "string") return false;
  if (o.description !== null && typeof o.description !== "string") return false;
  if (!Array.isArray(o.claims) || !o.claims.every((c) => typeof c === "string")) return false;
  return true;
}

function buildPrompt(text: string): string {
  return `You are reading text extracted from the reference/info pages of a wallpaper supplier's PDF catalogue (not the product listing pages themselves — general collection or material information, technology descriptions, care instructions, etc.). Extract ONLY facts EXPLICITLY stated in the text below. Never invent, infer, or embellish anything not directly stated — if something isn't clearly said, use null.

TEXT:
"""
${text.slice(0, 8000)}
"""

Respond with ONLY this JSON shape, no other text:
{
  "materialComposition": string | null (what the product is physically made of, e.g. "Non-woven", "Vinyl/PVC", "PVC coated embossed" — only if explicitly stated),
  "installationMethod": "peel_and_stick" | "paste_the_wall" | "paste_the_paper" | "professional" | null (only if the text clearly indicates one of these four; null if not stated or ambiguous),
  "warrantyInfo": string | null,
  "description": string | null (a short 1-2 sentence neutral summary using only facts stated in the text — not marketing language you add),
  "claims": string[] (a short list of specific notable claims actually made, e.g. "eco-friendly water-based ink", "washable" — for the reviewer's own reference only, not guaranteed to map cleanly to any one field)
}`;
}

/**
 * Returns null when there's no info-page text to work with, the API isn't
 * configured, or the call/response can't be trusted — callers treat null
 * as "nothing to suggest," never as an empty-but-confirmed result.
 */
export async function extractCollectionInfo(
  infoPageText: string,
  userId: string
): Promise<CollectionInfoFields | null> {
  const trimmed = infoPageText.trim();
  if (!trimmed) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return null;

  const t0 = Date.now();
  const prompt = buildPrompt(trimmed);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }
    );
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      void recordAiUsage({
        provider: "gemini",
        model: MODEL_ID,
        feature: "hm_catalogue_collection_info",
        durationMs,
        requestBytes: prompt.length,
        userId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
      });
      return null;
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_catalogue_collection_info",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs,
      requestBytes: prompt.length,
      userId,
      status: "success",
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    return isValidFields(parsed) ? parsed : null;
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_catalogue_collection_info",
      durationMs: Date.now() - t0,
      requestBytes: prompt.length,
      userId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
    });
    return null;
  }
}
