/**
 * Re-score the realism A/B test with a meaningful comparison: after-front vs
 * before-front, and after-back vs before-back directly — not against
 * product.imageUrl, which turned out to be an already-generated boutique
 * photo of a different model (a flaw in the original test, not the review
 * model). Delete after use.
 */
import "dotenv/config";

const RUBRIC = `You are a strict fashion e-commerce QA reviewer. Image 1 is a CANDIDATE revised model photo. Image 2 is the CURRENT production baseline for the same product. Rate how Image 1 compares to Image 2 on each dimension from 1 (much worse) to 5 (much better), where 3 means "about the same". Return raw JSON only, no markdown:
{"authenticity":0,"realism":0,"garmentPreservation":0,"drapeQuality":0,"expressionNaturalness":0,"poseNaturalness":0,"lightingQuality":0,"overall":0,"notes":""}
- authenticity: does Image 1 look more/less like a real photograph than Image 2
- realism: does Image 1 have more/less natural body, pose and lighting than Image 2
- garmentPreservation: does the garment still match the product correctly in Image 1
- drapeQuality: does the fabric fall/drape better or worse in Image 1
- expressionNaturalness: is the model's expression more or less natural/genuine in Image 1
- poseNaturalness: does the pose feel more or less alive/candid vs stiff/posed in Image 1
- lightingQuality: is the lighting/shadow more or less physically convincing in Image 1
- overall: holistic comparison 1-5
- notes: one sentence on the most noticeable difference`;

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { data, mime };
}

async function compare(label: string, afterUrl: string, beforeUrl: string) {
  const apiKey = process.env.GEMINI_API_KEY!;
  const after = await fetchImageAsBase64(afterUrl);
  const before = await fetchImageAsBase64(beforeUrl);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: after.mime, data: after.data } },
            { inline_data: { mime_type: before.mime, data: before.data } },
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
  console.log(`\n[${label}]`, JSON.parse(json));
}

async function main() {
  await compare(
    "after-front vs before-front",
    "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1787828340/product-match/realism-test/sdsoqjkuvxlul9bpjevd.jpg",
    "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1787828316/product-match/realism-test/zieiavlln013sskg8ufy.jpg",
  );
  await compare(
    "after-back vs before-back",
    "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1787828390/product-match/realism-test/hloegpl2wyhanbywcuaj.jpg",
    "https://res.cloudinary.com/dxmpq4xnk/image/upload/v1787828365/product-match/realism-test/a6johzqqyzmxhfajk0nn.jpg",
  );
}

main();
