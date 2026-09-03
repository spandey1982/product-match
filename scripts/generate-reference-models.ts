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
 *   npx tsx scripts/generate-reference-models.ts --only=woman-saree --profile=front --force
 *
 * Output files follow the legacy {type}-{variant}.{ext} scheme by default — a
 * single shot used for both front and back lookups. Pass --profile=front or
 * --profile=back to instead produce the preferred curated-pair filename
 * ({type}-{variant}-front/back.{ext}, see public/reference-models/README.md),
 * which the loader always prefers when present. Each profile is generated
 * independently (no cross-image identity chaining) — acceptable because the
 * live generation prompt no longer takes model identity from this reference
 * (see lib/model-gen/prompt-sets.ts's structure-only Image 1 clause); it only
 * needs correct drape geometry and real texture.
 *
 * --force never silently overwrites: any existing file at the target
 * basename is renamed to `{base}-legacy-{timestamp}.{ext}` first, mirroring
 * generate-face-library.ts's safety net.
 *
 * The models wear plain, form-fitting light-grey clothing so they work as a
 * clean "person" for Vertex try-on AND a neutral reference for Gemini.
 */
import "dotenv/config";
import { access, mkdir, rename, writeFile } from "fs/promises";
import { join } from "path";

const GEMINI_MODEL = "gemini-3.1-flash-image";
const OUT_DIR = join(process.cwd(), "public", "reference-models");

type ModelType = "woman" | "man" | "girl" | "boy";
type Variant = "basic" | "saree" | "lehenga" | "kurti" | "western";
type Profile = "front" | "back";

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

/**
 * Filename token per variant — matches reference-models.ts's
 * candidateBasenames aliasing exactly. Every curated file on disk uses
 * "base", never "basic" (woman-base-front.png, man-base-front.png, …); the
 * loader tries "basic" before falling back to "base", so a stray
 * "-basic-" file would silently shadow the real "-base-" asset instead of
 * replacing it. TypeScript variant key stays "basic" (matches
 * lib/model-gen/reference-models.ts's ModelVariant) — only the filename
 * token differs.
 */
function filenameToken(variant: Variant): string {
  return variant === "basic" ? "base" : variant;
}

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

/** Same stance per variant, described from behind instead of front-facing. */
const POSE_BACK: Record<Variant, string> = {
  basic:   "standing straight in a relaxed pose, seen directly from behind, arms slightly away from the body",
  saree:   "standing gracefully, seen directly from behind, an elegant posture suited to draping a saree, arms relaxed at the sides",
  lehenga: "standing with a gentle, confident stance suited to a flared lehenga skirt, seen directly from behind",
  kurti:   "standing straight with a natural posture suited to a knee-length kurti, seen directly from behind",
  western: "standing straight in a casual, confident posture, seen directly from behind",
};

/**
 * What the model is actually wearing. "basic"/"western" stay plain, neutral
 * clothing (the reference IS the clothing there, per the README's minimal
 * neutral-clothing note). saree/lehenga/kurti are genuinely draped in that
 * garment type — plain and unembellished so the reference stays a clean
 * drape/silhouette source, not a specific print or color to imitate. This
 * matches README's "same model, properly draped" definition of a variant;
 * getting this wrong produces a plain-clothed model with no drape structure
 * at all under a saree/lehenga/kurti filename, which is worse than useless.
 */
const GARMENT: Record<Variant, string> = {
  basic:   "wearing plain, form-fitting light-grey clothing with no patterns or logos",
  western: "wearing plain, form-fitting light-grey clothing with no patterns or logos",
  saree:   "wearing a well-draped plain muted slate-blue saree with a simple, well-fitted round-neck blouse in a matching plain tone — no patterns, prints or embellishments anywhere",
  lehenga: "wearing a well-fitted plain muted dusty-rose lehenga (fitted choli, flared ankle-length skirt) — no patterns, prints or embellishments anywhere",
  kurti:   "wearing a plain muted sage-green knee-length kurti over simple straight-leg trousers — no patterns, prints or embellishments anywhere",
};

function buildPrompt(type: ModelType, variant: Variant, profile?: Profile): string {
  const isBack = profile === "back";
  const pose = isBack ? POSE_BACK[variant] : POSE[variant];
  const facing = isBack
    ? "The entire body is visible from head to toe, centered, facing directly away from the camera — the back is fully visible, no part of the face or front of the body showing."
    : "The entire body is visible from head to toe, centered and facing the camera.";
  return [
    `Full-body fashion e-commerce model photograph of ${subject(type)},`,
    `${GARMENT[variant]},`,
    `${pose}.`,
    facing,
    "Clean seamless light-grey studio background, lit by a single soft key light with a gentle, soft-edged contact shadow directly beneath the feet where they meet the floor.",
    "Natural skin with visible pore-level texture and subtle tonal variation, not airbrushed or overly smooth. Fabric drapes and falls following natural cloth physics and gravity, never rigid or stiff.",
    "Shot as if on an 85mm portrait lens at a moderate aperture for natural photographic depth of field. This must read as an authentic photograph from a real studio session, not an illustration, render, or CGI.",
    "No text, no watermark, no props, no accessories.",
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
  apiKey: string,
  profile?: Profile
): Promise<{ ext: string; buffer: Buffer } | null> {
  const prompt = buildPrompt(type, variant, profile);
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
  const profileArg = args.find((a) => a.startsWith("--profile="))?.split("=")[1];
  if (profileArg && profileArg !== "front" && profileArg !== "back") {
    console.error(`--profile must be "front" or "back", got "${profileArg}".`);
    process.exit(1);
  }
  const profile = profileArg as Profile | undefined;

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
  console.log(`Model: ${GEMINI_MODEL} · targets: ${targets.length}${profile ? ` · profile=${profile}` : ""}${force ? " · force" : ""}\n`);

  let made = 0, skipped = 0, failed = 0;
  for (const { type, variant } of targets) {
    const token = filenameToken(variant);
    const base = profile ? `${type}-${token}-${profile}` : `${type}-${token}`;

    const existingPaths: string[] = [];
    for (const e of TRY_EXTS) {
      const p = join(OUT_DIR, `${base}.${e}`);
      if (await fileExists(p)) existingPaths.push(p);
    }

    if (existingPaths.length > 0) {
      if (!force) {
        console.log(`• ${base}  — exists, skipping (use --force to reroll)`);
        skipped++;
        continue;
      }
      // --force → never delete/overwrite. Legacy-rename first, matching
      // generate-face-library.ts's safety net.
      const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
      for (const p of existingPaths) {
        const ext = p.split(".").pop();
        const legacy = join(OUT_DIR, `${base}-legacy-${ts}.${ext}`);
        await rename(p, legacy);
        console.log(`  · kept previous as ${base}-legacy-${ts}.${ext}`);
      }
    }

    process.stdout.write(`• ${base}  — generating… `);
    const out = await generateOne(type, variant, apiKey, profile);
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
