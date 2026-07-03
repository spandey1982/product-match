import type { FabricAnalysis } from "../types";
import { callGeminiForJson, fetchImageAsPart } from "../gemini-client";

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
  // Use the first fabric image (primary reference)
  const imagePart = await fetchImageAsPart(fabricImageUrls[0]);
  if (!imagePart) throw new Error(`Failed to fetch fabric image: ${fabricImageUrls[0]}`);

  return callGeminiForJson<FabricAnalysis>(PROMPT, [imagePart]);
}
