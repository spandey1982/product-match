import type { DesignUnderstanding } from "../types";

const MODEL = "gemini-2.5-flash-lite";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const imageUrl = sketchOrReferenceUrls[0];
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return defaultDesignUnderstanding(garmentType);
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

  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!res.ok) return defaultDesignUnderstanding(garmentType);
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const clean = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as DesignUnderstanding;
    // Override garment category with user's explicit choice when provided
    if (garmentType) parsed.garmentCategory = garmentType;
    return parsed;
  } catch {
    return defaultDesignUnderstanding(garmentType);
  }
}
