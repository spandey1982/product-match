import type { FabricAnalysis, DesignUnderstanding, AccessoryAnalysis, GenerationPlan } from "../types";
import { callGeminiForJson } from "../gemini-client";
import { fieldOptionLabel, fieldOptionVisualHint, type GarmentTemplate } from "../templates";
import { resolveBodyCoverage, isTwoPieceCombination } from "../mannequin";
import type { AiUsageContext } from "@/lib/ai-usage/record";

function buildBlueprintSection(
  template: GarmentTemplate | null,
  structuredOptions: Record<string, string>
): string {
  if (!template) return "";

  const selections = template.fields
    .map((f) => {
      const value = structuredOptions[f.key] ?? f.default;
      const hint = fieldOptionVisualHint(f, value);
      const line = `- ${f.label}: ${fieldOptionLabel(f, value)}`;
      return hint ? `${line} — ${hint}` : line;
    })
    .join("\n");

  return `
CONSTRUCTION BLUEPRINT (authoritative — this defines the garment's fit, silhouette and construction; do not contradict it):
${template.blueprint}

STRUCTURED SELECTIONS (authoritative — the retailer's explicit choices, these override anything below and must be followed exactly, including the described visual look):
${selections}
`.trim();
}

/**
 * Some template fields cover the exact same attribute the (independent,
 * sometimes-blind) AI-inferred DesignUnderstanding also guesses at — e.g.
 * a Shirt's structured "Sleeve Length" and the free-text "sleeveStyle"
 * guess. When both are present, the retailer's structured choice must win
 * outright, so the conflicting AI guess is omitted from the prompt
 * entirely rather than relying on the model to arbitrate between two
 * contradictory facts sitting a few lines apart.
 */
const TEMPLATE_FIELD_OVERLAP: Record<string, keyof DesignUnderstanding> = {
  sleeveLength: "sleeveStyle",
};

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

  // Fields the template's own structured selections already cover are
  // omitted here entirely — not just de-prioritized — so there is never a
  // contradictory fact for the model to resolve (see TEMPLATE_FIELD_OVERLAP).
  const omittedDesignFields = new Set(
    (template?.fields ?? [])
      .map((f) => TEMPLATE_FIELD_OVERLAP[f.key])
      .filter((k): k is keyof DesignUnderstanding => !!k)
  );

  // Design understanding is secondary once a structured blueprint exists — it
  // only fills in details the blueprint doesn't cover (embroidery, borders,
  // decorative elements, closures). Without a template (e.g. Saree, Lehenga),
  // it remains the primary source, unchanged from before.
  const designLabel = blueprintSection
    ? "AI-INFERRED DESIGN ANALYSIS (secondary — use ONLY to fill in details not already specified by the blueprint/structured selections above, e.g. embroidery, borders, decorative elements, closures):"
    : "DESIGN:";
  const designLines = [
    `- Garment: ${design.garmentCategory || garmentType}`,
    !omittedDesignFields.has("neckStyle") && `- Neck: ${design.neckStyle}`,
    !omittedDesignFields.has("sleeveStyle") && `- Sleeves: ${design.sleeveStyle}`,
    !omittedDesignFields.has("backStyle") && `- Back: ${design.backStyle}`,
    !omittedDesignFields.has("fit") && `- Fit: ${design.fit}`,
    !omittedDesignFields.has("length") && `- Length: ${design.length}`,
    !omittedDesignFields.has("closure") && `- Closure: ${design.closure}`,
    !omittedDesignFields.has("pleats") && `- Pleats: ${design.pleats}`,
    !omittedDesignFields.has("panels") && `- Panels: ${design.panels}`,
    !omittedDesignFields.has("borders") && `- Borders: ${design.borders}`,
    !omittedDesignFields.has("embroidery") && `- Embroidery: ${design.embroidery}`,
    !omittedDesignFields.has("stitchLines") && `- Stitch Lines: ${design.stitchLines}`,
    !omittedDesignFields.has("decorativeElements") && `- Decorative Elements: ${design.decorativeElements}`,
  ].filter((l): l is string => !!l);
  const designContext = `${designLabel}\n${designLines.join("\n")}`;

  const notesSection = designNotes.trim()
    ? `DESIGN NOTES (retailer's explicit small refinements — apply these):\n${designNotes.trim()}`
    : "";

  const bodyCoverage = resolveBodyCoverage(garmentType, design);
  const presentationContext = {
    upper: "PRESENTATION (authoritative): display the garment on a HALF/TORSO MANNEQUIN FORM (or a full mannequin cropped at/below the knee — either is fine) — a headless, faceless, plain neutral-toned dress form, the way premium e-commerce sites photograph shirts and short kurtas. Do NOT show a flat lay.",
    full: "PRESENTATION (authoritative): display the garment on a FULL-LENGTH MANNEQUIN FORM. The ENTIRE mannequin, head to feet, MUST be fully visible in frame with clear margin above and below — do NOT crop the legs, knees, ankles or feet under any circumstance. Zoom the camera OUT as needed so the complete garment length fits in frame. Do NOT show a flat lay.",
    lower: "PRESENTATION (authoritative): this is a BOTTOM-only garment. Frame the camera on the LOWER body only — crop out the head, shoulders and upper torso entirely; center the composition on the waist-to-feet region of a full mannequin so the garment fills most of the frame. Do NOT show a flat lay.",
  }[bodyCoverage];

  const combinationContext = isTwoPieceCombination(garmentType)
    ? "TWO-PIECE COORDINATION (authoritative): this is a two-piece suit (jacket + trouser). The front image must show a crisp collared shirt worn underneath the jacket — visible at the collar and cuffs, jacket open or partially buttoned — in a color that tastefully complements the suit fabric (e.g. white, cream, or a soft tone from the same palette). Present it as a complete coordinated set, not the jacket alone."
    : "";

  const negativeInstructionsContext =
    "DO NOT (authoritative, applies to both front and back): do not render any clothing tag, neck label, brand label, size tag, hang tag, or logo anywhere on the garment. Garment care/brand tags are never part of professional product photography.";

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
    negativeInstructionsContext,
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
  "flatFrontPrompt": "Detailed image generation prompt for a FRONT VIEW product image of this garment displayed on the mannequin form specified in PRESENTATION above (NOT a flat lay), on a plain white studio background with professional lighting. Include fabric texture, color, pattern, all design elements, accessories placement, and restate the mannequin form and framing explicitly. Explicitly restate every STRUCTURED SELECTIONS value and its described visual look (sleeve length, collar, cuff, pocket, etc. — whatever applies) so it cannot be missed. Explicitly state no clothing tag/label/logo should be visible. The image must look like professional e-commerce product photography. Be very specific about every visual detail.",
  "flatBackPrompt": "Detailed image generation prompt for a BACK VIEW product image of the same garment, on the SAME mannequin form and framing as the front (NOT a flat lay). Describe what the back looks like based on the back style, and restate any STRUCTURED SELECTIONS visible from the back (e.g. cuffs, sleeve length). Explicitly state no clothing tag/label/logo should be visible. Match the fabric, color, pattern exactly.",
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
