import type { DesignUnderstanding } from "../types";
import { callGeminiForJson, fetchImageAsPart } from "../gemini-client";

const PROMPT = `
You are a fashion design expert specialising in Indian ethnic garments.

Analyse this design sketch or reference garment image and extract the structural design elements.
Return ONLY valid JSON — no markdown, no explanation.

{
  "garmentCategory": "e.g. Blouse / Kurti / Saree / Lehenga / Salwar / Anarkali",
  "neckStyle": "e.g. Round / V-neck / Boat / Sweetheart / Mandarin / Halter / Keyhole",
  "sleeveStyle": "e.g. Sleeveless / Short / Elbow / Full / Bell / Puff / Bishop / Bateau",
  "backStyle": "e.g. Deep U / Round / Keyhole / Open / Closed / Bow-tie",
  "fit": "e.g. Fitted / Regular / Loose / Flared / A-line / Straight",
  "length": "e.g. Crop / Hip / Knee / Midi / Ankle / Floor",
  "closure": "e.g. Hooks / Zipper / Buttons / Tie / Open / Snap",
  "pleats": "e.g. None / Box pleats / Knife pleats / Pin tucks",
  "panels": "e.g. None / Side panels / Yoke / Princess cut",
  "borders": "e.g. None / Gold lace / Zari border / Ribbon / Embroidered border",
  "embroidery": "e.g. None / Mirror work / Thread work / Zardosi / Sequins / Kantha",
  "stitchLines": "e.g. None / Princess seams / Side seams / Yoke seams",
  "decorativeElements": "e.g. None / Tassels / Buttons / Brooch / Beads / Patch work"
}
`.trim();

function defaultDesignUnderstanding(garmentType: string): DesignUnderstanding {
  return {
    garmentCategory: garmentType || "Kurti",
    neckStyle: "Round",
    sleeveStyle: "Short",
    backStyle: "Round",
    fit: "Regular",
    length: "Knee",
    closure: "None",
    pleats: "None",
    panels: "None",
    borders: "None",
    embroidery: "None",
    stitchLines: "Side seams",
    decorativeElements: "None",
  };
}

export async function designUnderstandingAgent(
  sketchOrReferenceUrls: string[],
  garmentType: string
): Promise<DesignUnderstanding> {
  if (sketchOrReferenceUrls.length === 0) {
    return defaultDesignUnderstanding(garmentType);
  }

  try {
    const imagePart = await fetchImageAsPart(sketchOrReferenceUrls[0]);
    if (!imagePart) return defaultDesignUnderstanding(garmentType);

    const parsed = await callGeminiForJson<DesignUnderstanding>(PROMPT, [imagePart]);
    // Override garment category with user's explicit choice when provided
    if (garmentType) parsed.garmentCategory = garmentType;
    return parsed;
  } catch {
    return defaultDesignUnderstanding(garmentType);
  }
}
