import type { AccessoryAnalysis, AccessoryItem } from "../types";

const MODEL = "gemini-2.5-flash-lite";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { items: [] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const results = await Promise.allSettled(
    accessoryAssets.map(async (asset): Promise<AccessoryItem> => {
      const imgRes = await fetch(asset.url);
      if (!imgRes.ok) throw new Error(`Cannot fetch accessory image: ${asset.url}`);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = imgRes.headers.get("content-type") ?? asset.mimeType;

      const body = JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
            { text: buildPrompt(asset.assetType) },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      });

      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) throw new Error(`Accessory analysis failed: ${res.status}`);

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const clean = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(clean) as AccessoryItem;
    })
  );

  const items = results
    .filter((r): r is PromiseFulfilledResult<AccessoryItem> => r.status === "fulfilled")
    .map((r) => r.value);

  return { items };
}
