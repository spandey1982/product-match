/**
 * Offline reference-model generator — TEAM TOOL, never runs at request time.
 *
 * Generates candidate reference-model images (the curated "store models" the AI
 * Generation engine uses) into public/reference-models/ via Gemini. The team
 * runs this once, curates/replaces the results, and commits them so production
 * ships with a fixed, deterministic set — retailers never generate anything.
 *
 * Usage:
 *   npx tsx scripts/generate-reference-models.ts                 # all missing
 *   npx tsx scripts/generate-reference-models.ts --force         # regenerate all
 *   npx tsx scripts/generate-reference-models.ts --only=woman-basic
 *
 * Output files follow lib/model-gen/reference-models.ts: {type}-{variant}.{ext}.
 * The models wear plain, form-fitting light-grey clothing so they work as a
 * clean "person" for Vertex try-on AND a neutral reference for Gemini.
 */
import "dotenv/config";
import { access, mkdir, writeFile } from "fs/promises";
import { join } from "path";

const GEMINI_MODEL = "gemini-3.1-flash-image";
const OUT_DIR = join(process.cwd(), "public", "reference-models");

type ModelType = "woman" | "man" | "girl" | "boy";
type Variant = "basic" | "saree" | "lehenga" | "kurti" | "western";

/**
 * Which {type}-{variant} files to produce (mirrors the README manifest).
 *
 * IMPORTANT: a variant is the SAME base model already *wearing that garment
 * type, properly draped* (e.g. woman-saree = the woman-basic model in a draped
 * saree) — NOT a new model and NOT plain clothing. Vertex takes no prompt, so a
 * garment-draped person image is what tells it how to place the product. The
 * `basic` model wears minimal neutral clothing. man/boy use `basic` only.
 */
const MANIFEST: Record<ModelType, Variant[]> = {
  woman: ["basic", "saree", "lehenga", "kurti", "western"],
  man:   ["basic"],
  girl:  ["basic", "saree", "lehenga", "kurti"],
  boy:   ["basic"],
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const TRY_EXTS = ["webp", "png", "jpg", "jpeg"];

function subject(type: ModelType): string {
  switch (type) {
    case "woman": return "a young adult Indian woman, around 25 years old, with natural light makeup and hair neatly tied back";
    case "man":   return "a young adult Indian man, around 30 years old, clean-groomed with short hair";
    case "girl":  return "a young Indian girl, around 8 years old, cheerful and natural";
    case "boy":   return "a young Indian boy, around 8 years old, cheerful and natural";
  }
}

const POSE: Record<Variant, string> = {
  basic:   "standing straight in a relaxed front-facing pose, arms slightly away from the body",
  saree:   "standing gracefully and front-facing, an elegant posture suited to draping a saree, arms relaxed at the sides",
  lehenga: "standing front-facing with a gentle, confident stance suited to a flared lehenga skirt",
  kurti:   "standing straight and front-facing with a natural posture suited to a knee-length kurti",
  western: "standing straight and front-facing in a casual, confident posture",
};

function buildPrompt(type: ModelType, variant: Variant): string {
  return [
    `Full-body fashion e-commerce model photograph of ${subject(type)},`,
    "wearing plain, form-fitting light-grey clothing with no patterns or logos,",
    `${POSE[variant]}.`,
    "The entire body is visible from head to toe, centered and facing the camera.",
    "Clean seamless light-grey studio background, soft even lighting, photorealistic,",
    "high resolution, sharp focus, no text, no watermark, no props, no accessories.",
  ].join(" ");
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
    finishReason?: string;
  }>;
}

async function generateOne(
  type: ModelType,
  variant: Variant,
  apiKey: string
): Promise<{ ext: string; buffer: Buffer } | null> {
  const prompt = buildPrompt(type, variant);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );

  if (!res.ok) {
    console.error(`\n  ✗ Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as GeminiImageResponse;
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData) {
    console.error(`\n  ✗ no image returned (finish: ${data.candidates?.[0]?.finishReason ?? "?"})`);
    return null;
  }

  const ext = EXT_BY_MIME[part.inlineData.mimeType] ?? "png";
  return { ext, buffer: Buffer.from(part.inlineData.data, "base64") };
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    console.error("GEMINI_API_KEY is not configured in .env");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  await mkdir(OUT_DIR, { recursive: true });

  const targets: Array<{ type: ModelType; variant: Variant }> = [];
  for (const type of Object.keys(MANIFEST) as ModelType[]) {
    for (const variant of MANIFEST[type]) {
      if (only && `${type}-${variant}` !== only) continue;
      targets.push({ type, variant });
    }
  }
  if (targets.length === 0) {
    console.error(`No matching targets${only ? ` for --only=${only}` : ""}.`);
    process.exit(1);
  }

  console.log(`Reference-model generator → ${OUT_DIR}`);
  console.log(`Model: ${GEMINI_MODEL} · targets: ${targets.length}${force ? " · force" : ""}\n`);

  let made = 0, skipped = 0, failed = 0;
  for (const { type, variant } of targets) {
    const base = `${type}-${variant}`;

    if (!force) {
      const present = await Promise.all(
        TRY_EXTS.map((e) => fileExists(join(OUT_DIR, `${base}.${e}`)))
      );
      if (present.some(Boolean)) {
        console.log(`• ${base}  — exists, skipping`);
        skipped++;
        continue;
      }
    }

    process.stdout.write(`• ${base}  — generating… `);
    const out = await generateOne(type, variant, apiKey);
    if (!out) { failed++; continue; }

    await writeFile(join(OUT_DIR, `${base}.${out.ext}`), out.buffer);
    console.log(`saved ${base}.${out.ext} (${Math.round(out.buffer.length / 1024)} KB)`);
    made++;

    await new Promise((r) => setTimeout(r, 1200)); // gentle pacing
  }

  console.log(`\nDone. made=${made} skipped=${skipped} failed=${failed}`);
  if (made > 0) {
    console.log("Review the images, replace any you don't like, then commit public/reference-models/.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
