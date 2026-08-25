import type { FabricAnalysis, DesignUnderstanding, AccessoryAnalysis, GenerationPlan } from "../types";
import { callGeminiForJson } from "../gemini-client";
import { fieldOptionLabel, type GarmentTemplate } from "../templates";
import { resolveMannequinType, isTwoPieceCombination } from "../mannequin";
import type { AiUsageContext } from "@/lib/ai-usage/record";

function buildBlueprintSection(
  template: GarmentTemplate | null,
  structuredOptions: Record<string, string>
): string {
  if (!template) return "";

  const selections = template.fields
    .map((f) => `- ${f.label}: ${fieldOptionLabel(f, structuredOptions[f.key] ?? f.default)}`)
    .join("\n");

  return `
CONSTRUCTION BLUEPRINT (authoritative — this defines the garment's fit, silhouette and construction; do not contradict it):
${template.blueprint}

STRUCTURED SELECTIONS (authoritative — the retailer's explicit choices):
${selections}
`.trim();
}

export async function plannerAgent(
  fabric: FabricAnalysis,
  design: DesignUnderstanding,
  accessories: AccessoryAnalysis,
  garmentType: string,
  template: GarmentTemplate | null = null,
  structuredOptions: Record<string, string> = {},
  designNotes = "",
  usage?: AiUsageContext
): Promise<GenerationPlan> {
  const fabricContext = `
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
`.trim();

  const blueprintSection = buildBlueprintSection(template, structuredOptions);

  // Design understanding is secondary once a structured blueprint exists — it
  // only fills in details the blueprint doesn't cover (embroidery, borders,
  // decorative elements, closures). Without a template (e.g. Saree, Lehenga),
  // it remains the primary source, unchanged from before.
  const designLabel = blueprintSection
    ? "AI-INFERRED DESIGN ANALYSIS (secondary — use ONLY to fill in details not already specified by the blueprint/structured selections above, e.g. embroidery, borders, decorative elements, closures):"
    : "DESIGN:";
  const designContext = `
${designLabel}
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
`.trim();

  const notesSection = designNotes.trim()
    ? `DESIGN NOTES (retailer's explicit small refinements — apply these):\n${designNotes.trim()}`
    : "";

  const mannequinType = resolveMannequinType(garmentType, design);
  const presentationContext =
    mannequinType === "half"
      ? "PRESENTATION (authoritative): display the garment on a HALF/TORSO MANNEQUIN FORM — a headless, faceless, plain neutral-toned dress form ending at the waist/hip, the way premium e-commerce sites photograph shirts and short kurtas. Do NOT show a flat lay."
      : "PRESENTATION (authoritative): display the garment on a FULL-LENGTH MANNEQUIN FORM — a headless, faceless, plain neutral-toned dress form showing the complete garment from shoulders to hem. Do NOT show a flat lay.";

  const combinationContext = isTwoPieceCombination(garmentType)
    ? "TWO-PIECE COORDINATION (authoritative): this is a two-piece suit (jacket + trouser). The front image must show a crisp collared shirt worn underneath the jacket — visible at the collar and cuffs, jacket open or partially buttoned — in a color that tastefully complements the suit fabric (e.g. white, cream, or a soft tone from the same palette). Present it as a complete coordinated set, not the jacket alone."
    : "";

  const accessoriesContext = `
ACCESSORIES:
${accessories.items.length === 0
    ? "None"
    : accessories.items.map((a) =>
        `- ${a.type} (${a.color}, ${a.dimensions}) → placement: ${a.placementSuggestion}`
      ).join("\n")}
`.trim();

  const context = [
    presentationContext,
    blueprintSection,
    fabricContext,
    designContext,
    notesSection,
    accessoriesContext,
    combinationContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `
You are a master fashion designer and AI image generation expert specialising in Indian ethnic garments and tailored menswear.

Given the information below, create a complete generation plan. Where a CONSTRUCTION BLUEPRINT and STRUCTURED SELECTIONS section is present, it is the retailer's explicit, authoritative choice — it must be followed exactly and takes precedence over any AI-inferred design analysis.

${context}

Return ONLY valid JSON — no markdown, no explanation:

{
  "garmentDescription": "2-3 sentence human-readable summary of the final garment design",
  "flatFrontPrompt": "Detailed image generation prompt for a FRONT VIEW product image of this garment displayed on the mannequin form specified in PRESENTATION above (NOT a flat lay), on a plain white studio background with professional lighting. Include fabric texture, color, pattern, all design elements, accessories placement, and restate the mannequin form explicitly. The image must look like professional e-commerce product photography. Be very specific about every visual detail.",
  "flatBackPrompt": "Detailed image generation prompt for a BACK VIEW product image of the same garment, on the SAME mannequin form and framing as the front (NOT a flat lay). Describe what the back looks like based on the back style. Match the fabric, color, pattern exactly.",
  "panelNotes": "How the fabric panels should be cut and assembled for this garment type",
  "stitchingNotes": "Key stitching details — seam types, finishing, special techniques",
  "accessoryPlacement": "Precise placement of each accessory on the garment",
  "printContinuityNotes": "How to ensure fabric print/pattern continues naturally across seams and panels"
}
`.trim();

  return callGeminiForJson<GenerationPlan>(prompt, [], {
    temperature: 0.3,
    usage: usage ? { ...usage, operation: "planning" } : undefined,
  });
}
