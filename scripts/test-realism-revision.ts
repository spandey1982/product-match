/**
 * Steps 2-4 of the "Why It Looks AI" research: a controlled, reversible A/B
 * test of the research-informed prompt revision against the exact current
 * production prompt, for one real saree product.
 *
 * Faithful to production: uses the REAL buildViewPrompt(), the REAL
 * reference-model assets (resolveModelType/resolveReferenceVariant/
 * loadReferenceImage), the REAL renderBackdropPrompt(), and the REAL
 * runGeminiImageGen() — the only variable that differs between "before" and
 * "after" is a narrative revision suffix appended to the end of the prompt,
 * using the same recency-wins mechanism the codebase already relies on for
 * AI Casting's castingSuffix and the orientation clause. Nothing in
 * production code is touched.
 *
 * Deliberately pinned to the "reference-studio" (Boutique Beige) backdrop
 * preset for both variants — the documented benchmark — rather than
 * replicating smart-match's product-signal scoring, so the comparison is
 * clean and reproducible. Regenerates BOTH before and after (not reusing the
 * product's existing catalogue images) so backdrop/prompt are identical
 * across the pair — a true apples-to-apples test.
 *
 * Scoring reuses the exact rubric from lib/model-gen/ai-review.ts, called
 * directly (no GenerationRecord rows created — this is an ad-hoc comparison,
 * not a persisted catalogue generation).
 *
 * Delete after use.
 */
import "dotenv/config";
import { writeFile } from "fs/promises";
import { db } from "../lib/db";
import { fetchProductImageBuffer, runGeminiImageGen } from "../lib/generate-model-image";
import { resolvePromptSet, buildViewPrompt } from "../lib/model-gen/prompt-sets";
import { getBackdropPreset, renderBackdropPrompt } from "../lib/model-gen/backdrops";
import { resolveModelType } from "../lib/model-gen/model-selection";
import { resolveReferenceVariant } from "../lib/model-gen/reference-selection";
import { loadReferenceImage } from "../lib/model-gen/reference-models";

const PRODUCT_ID = "cmso6g53m0002x4lber4d61af"; // Yellow Embroidered Silk Saree
const OUT_DIR = process.argv[2] || ".";

// ── Research-informed revision suffixes ─────────────────────────────────────
// Narrative style (Gemini's own stated preference), appended AFTER the full
// production prompt so it reads as a deliberate refinement, not a
// contradiction — same recency-wins pattern the codebase already uses.

const REVISION_CORE =
  "For photographic realism: render natural skin with visible pore-level texture and subtle tonal " +
  "variation, not airbrushed or overly smooth. Lit by a single large softbox key light at a soft " +
  "45-degree angle with warm, natural color temperature suited to the model's skin tone — a visible, " +
  "tight, soft-edged contact shadow directly beneath the feet where they meet the floor, consistent in " +
  "direction with the key light. Spine upright, weight settled naturally onto one leg without breaking " +
  "the mandatory front-facing requirement above. Saree pleats hanging straight and symmetrical, " +
  "unwrinkled. Shot as if on an 85mm portrait lens at a wide aperture, natural photographic depth of " +
  "field separating the model from the backdrop. This must read as an authentic photograph from a real " +
  "studio session, not an illustration, render, or CGI.";

const REVISION_FRONT =
  `${REVISION_CORE} A relaxed, natural expression with the eyes engaged and a soft catchlight visible ` +
  `in both eyes from the key light — not a flat, posed smile.`;

const REVISION_BACK =
  `${REVISION_CORE} The pallu falls exactly as already described — floor-length, undisturbed — but ` +
  `rendered as if a moment ago the model's hand adjusted it: one hand resting lightly near the pallu's ` +
  `edge at shoulder height, not gripping or lifting it, with a very gentle, soft natural sway at the ` +
  `pallu's lower edge from indoor air — never a dramatic flare or swing.`;

// ── Scoring (rubric copied verbatim from lib/model-gen/ai-review.ts) ────────

const REVIEW_MODEL = "gemini-2.5-flash-lite";
const RUBRIC = `You are a strict fashion e-commerce QA reviewer. Image 1 is an AI-GENERATED model photo. Image 2 is the ORIGINAL product. Rate Image 1 from 1 (poor) to 5 (excellent). Return raw JSON only, no markdown:
{"authenticity":0,"realism":0,"garmentPreservation":0,"drapeQuality":0,"patternPreservation":0,"textureQuality":0,"productVisibility":0,"renderingQuality":0,"overall":0,"issues":[]}
- authenticity: looks like a real photograph, not obviously AI-generated
- realism: natural body, pose and lighting; no artifacts or extra/missing limbs
- garmentPreservation: the garment matches the product in shape, cut and colour
- drapeQuality: the fabric falls and drapes naturally and correctly
- patternPreservation: the print/pattern/motif is preserved faithfully
- textureQuality: fabric texture/weave is visible and convincing
- productVisibility: the product is clearly shown, unobstructed and well-framed
- renderingQuality: sharp, high-resolution, undistorted
- overall: holistic quality 1-5
- issues: short array of any problems seen, e.g. ["soft texture","color shift","extra limb"] (empty array if none)`;

async function fetchImageAsBase64(url: string): Promise<{ data: string; mime: string }> {
  const res = await fetch(url);
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { data, mime };
}

async function score(label: string, outputUrl: string, productImageUrl: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const output = await fetchImageAsBase64(outputUrl);
  const product = await fetchImageAsBase64(productImageUrl);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${REVIEW_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: output.mime, data: output.data } },
            { inline_data: { mime_type: product.mime, data: product.data } },
            { text: RUBRIC },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );
  const data = await res.json();
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const scores = JSON.parse(json);
  console.log(`\n[${label}] scores:`, scores);
  return scores;
}

async function main() {
  const product = await db.product.findUnique({
    where: { id: PRODUCT_ID },
    select: { id: true, title: true, category: true, color: true, gender: true, imageUrl: true, backImageUrl: true, detailNotes: true, backDetailNotes: true },
  });
  if (!product) throw new Error("Product not found");
  console.log(`Product: ${product.title} (${product.category}, ${product.color})`);

  const modelType = resolveModelType(product.category, product.gender, "woman");
  const variant = resolveReferenceVariant(product.category);
  const frontRef = await loadReferenceImage(modelType, variant, { profile: "front" });
  const backRef = await loadReferenceImage(modelType, variant, { profile: "back" });
  console.log(`Reference model: ${modelType}-${variant} (front=${!!frontRef} back=${!!backRef})`);

  const backdropPreset = getBackdropPreset("reference-studio")!;
  const backdropFragment = renderBackdropPrompt(backdropPreset);

  const [frontView, backView] = resolvePromptSet(product.category).filter((v) => v.id === "front" || v.id === "back");

  const frontSource = await fetchProductImageBuffer(product.imageUrl!);
  const backSource = product.backImageUrl ? await fetchProductImageBuffer(product.backImageUrl) : frontSource;
  if (!frontSource || !backSource) throw new Error("Could not fetch product source images");

  const baseFrontPrompt = buildViewPrompt({
    category: product.category, color: product.color, gender: product.gender, view: frontView,
    hasReference: !!frontRef, detailNotes: product.detailNotes, backdrop: backdropFragment,
  });
  const baseBackPrompt = buildViewPrompt({
    category: product.category, color: product.color, gender: product.gender, view: backView,
    hasReference: !!backRef, detailNotes: product.backDetailNotes, backdrop: backdropFragment,
  });

  const variants: Array<{ label: string; view: "front" | "back"; prompt: string; ref: typeof frontRef; src: typeof frontSource }> = [
    { label: "before-front", view: "front", prompt: baseFrontPrompt, ref: frontRef, src: frontSource },
    { label: "after-front", view: "front", prompt: `${baseFrontPrompt} ${REVISION_FRONT}`, ref: frontRef, src: frontSource },
    { label: "before-back", view: "back", prompt: baseBackPrompt, ref: backRef, src: backSource },
    { label: "after-back", view: "back", prompt: `${baseBackPrompt} ${REVISION_BACK}`, ref: backRef, src: backSource },
  ];

  const results: Array<{ label: string; url: string }> = [];

  for (const v of variants) {
    console.log(`\n=== ${v.label} ===`);
    const result = await runGeminiImageGen({
      productId: product.id,
      productTitle: product.title,
      productCategory: product.category,
      productColor: product.color,
      productBuffer: v.src.buffer,
      productMime: v.src.mime,
      referenceBuffer: v.ref?.buffer ?? null,
      referenceMime: v.ref?.mime ?? null,
      prompt: v.prompt,
      folder: "product-match/realism-test",
      view: `test-${v.label}`,
      usage: { feature: "realism_revision_test" },
    });
    if (!result) { console.error(`FAILED: ${v.label}`); continue; }
    console.log(`Saved: ${result.url}`);
    results.push({ label: v.label, url: result.url });

    const buf = await fetch(result.url).then((r) => r.arrayBuffer());
    await writeFile(`${OUT_DIR}/${v.label}.jpg`, Buffer.from(buf));
  }

  console.log("\n\n========== SCORING ==========");
  const scores: Record<string, Record<string, unknown>> = {};
  for (const r of results) {
    scores[r.label] = await score(r.label, r.url, product.imageUrl!);
  }

  console.log("\n\n========== SUMMARY ==========");
  for (const dim of ["authenticity", "realism", "overall"]) {
    const bf = scores["before-front"]?.[dim];
    const af = scores["after-front"]?.[dim];
    const bb = scores["before-back"]?.[dim];
    const ab = scores["after-back"]?.[dim];
    console.log(`${dim.padEnd(14)} front: ${bf} -> ${af}   back: ${bb} -> ${ab}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
