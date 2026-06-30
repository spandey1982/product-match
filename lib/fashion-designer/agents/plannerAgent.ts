import type { FabricAnalysis, DesignUnderstanding, AccessoryAnalysis, GenerationPlan } from "../types";

const MODEL = "gemini-2.5-flash-lite";

export async function plannerAgent(
  fabric: FabricAnalysis,
  design: DesignUnderstanding,
  accessories: AccessoryAnalysis,
  garmentType: string
): Promise<GenerationPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const context = `
FABRIC:
- Type: ${fabric.fabricType}
- Color: ${fabric.color}
- Pattern: ${fabric.pattern}
- Texture: ${fabric.texture}
- Pattern Repeat: ${fabric.patternRepeat}
- Finish: ${fabric.finish}
- Transparency: ${fabric.transparency}
- Shine: ${fabric.shine}
- Weave: ${fabric.weave}
- Orientation: ${fabric.orientation}

DESIGN:
- Garment: ${design.garmentCategory || garmentType}
- Neck: ${design.neckStyle}
- Sleeves: ${design.sleeveStyle}
- Back: ${design.backStyle}
- Fit: ${design.fit}
- Length: ${design.length}
- Closure: ${design.closure}
- Pleats: ${design.pleats}
- Panels: ${design.panels}
- Borders: ${design.borders}
- Embroidery: ${design.embroidery}
- Stitch Lines: ${design.stitchLines}
- Decorative Elements: ${design.decorativeElements}

ACCESSORIES:
${accessories.items.length === 0
    ? "None"
    : accessories.items.map((a) =>
        `- ${a.type} (${a.color}, ${a.dimensions}) → placement: ${a.placementSuggestion}`
      ).join("\n")}
`.trim();

  const prompt = `
You are a master fashion designer and AI image generation expert specialising in Indian ethnic garments.

Given the fabric analysis, design specifications, and accessories below, create a complete generation plan.

${context}

Return ONLY valid JSON — no markdown, no explanation:

{
  "garmentDescription": "2-3 sentence human-readable summary of the final garment design",
  "flatFrontPrompt": "Detailed image generation prompt for a FRONT VIEW flat lay product image of this garment on a plain white background with studio lighting. Include fabric texture, color, pattern, all design elements, accessories placement. The image must look like professional e-commerce product photography. Be very specific about every visual detail.",
  "flatBackPrompt": "Detailed image generation prompt for a BACK VIEW flat lay product image of the same garment on white background. Describe what the back looks like based on the back style. Match the fabric, color, pattern exactly.",
  "panelNotes": "How the fabric panels should be cut and assembled for this garment type",
  "stitchingNotes": "Key stitching details — seam types, finishing, special techniques",
  "accessoryPlacement": "Precise placement of each accessory on the garment",
  "printContinuityNotes": "How to ensure fabric print/pattern continues naturally across seams and panels"
}
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  });

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok) throw new Error(`Planner API error: ${res.status}`);

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const clean = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean) as GenerationPlan;
}
