import type { FabricAnalysis } from "../types";

const MODEL = "gemini-2.5-flash-lite";

const PROMPT = `
You are a textile and fabric expert for Indian fashion.

Analyze this fabric image carefully and extract the following properties.
Return ONLY valid JSON — no markdown, no explanation.

{
  "fabricType": "e.g. Cotton Silk / Pure Silk / Georgette / Chiffon / Linen",
  "color": "primary color name(s)",
  "pattern": "e.g. Floral / Paisley / Geometric / Solid / Stripes / Zari",
  "texture": "e.g. Smooth / Rough / Grainy / Soft / Crisp",
  "patternRepeat": "e.g. Small / Medium / Large / No repeat",
  "finish": "e.g. Matte / Shiny / Semi-shiny / Metallic",
  "transparency": "e.g. Opaque / Semi-transparent / Sheer",
  "shine": "e.g. High / Medium / Low / None",
  "weave": "e.g. Plain / Twill / Satin / Jacquard / Handloom / Unknown",
  "orientation": "e.g. Vertical / Horizontal / Diagonal / Allover / Random"
}
`.trim();

export async function fabricAnalysisAgent(
  fabricImageUrls: string[]
): Promise<FabricAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // Use the first fabric image (primary reference)
  const imageUrl = fabricImageUrls[0];
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch fabric image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
        { text: PROMPT },
      ],
    }],
    generationConfig: { temperature: 0.1 },
  });

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok) throw new Error(`Fabric analysis API error: ${res.status}`);

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const clean = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();

  const parsed = JSON.parse(clean) as FabricAnalysis;
  return parsed;
}
