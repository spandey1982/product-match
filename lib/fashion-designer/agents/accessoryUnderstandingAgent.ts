import type { AccessoryAnalysis, AccessoryItem } from "../types";
import { callGeminiForJson, fetchImageAsPart } from "../gemini-client";

function buildPrompt(assetType: string) {
  return `
You are a fashion accessory expert specialising in Indian ethnic wear.

Analyse this ${assetType} image and extract its properties.
Return ONLY valid JSON — no markdown, no explanation.

{
  "type": "specific accessory type e.g. Tassel / Jhumka / Button / Zari lace / Brooch / Stone / Bead",
  "color": "primary color(s) of the accessory",
  "dimensions": "approximate size e.g. Small (1cm) / Medium (3cm) / Large (5cm+)",
  "placementSuggestion": "where on the garment this accessory works best e.g. Neckline / Hemline / Sleeve edge / Center front / Waistband"
}
`.trim();
}

export async function accessoryUnderstandingAgent(
  assets: Array<{ url: string; assetType: string; mimeType: string }>
): Promise<AccessoryAnalysis> {
  const accessoryTypes = new Set([
    "accessory", "border", "neck", "sleeve", "back",
  ]);
  const accessoryAssets = assets.filter((a) => accessoryTypes.has(a.assetType));

  if (accessoryAssets.length === 0) return { items: [] };
  if (!process.env.GEMINI_API_KEY) return { items: [] };

  const results = await Promise.allSettled(
    accessoryAssets.map(async (asset): Promise<AccessoryItem> => {
      const imagePart = await fetchImageAsPart(asset.url, asset.mimeType);
      if (!imagePart) throw new Error(`Cannot fetch accessory image: ${asset.url}`);
      return callGeminiForJson<AccessoryItem>(buildPrompt(asset.assetType), [imagePart]);
    })
  );

  const items = results
    .filter((r): r is PromiseFulfilledResult<AccessoryItem> => r.status === "fulfilled")
    .map((r) => r.value);

  return { items };
}
