/**
 * Offline face-library generator — TEAM TOOL, never runs at request time.
 *
 * Generates the 12 curated portrait references (6 regions × 2 sexes) that
 * anchor AI Casting's identity axis, into public/reference-models/faces/.
 * The registry in lib/model-gen/faces.ts defines the expected ids
 * (`north-f-1`, `south-m-1`, …); this script produces the assets that back
 * those ids. Retailers never generate anything — like the sibling
 * `generate-reference-models.ts`, this is one-off team infrastructure.
 *
 * Usage:
 *   npx tsx scripts/generate-face-library.ts                 # all missing
 *   npx tsx scripts/generate-face-library.ts --force         # regenerate all
 *   npx tsx scripts/generate-face-library.ts --only=north-f-1
 *
 * Output convention: `{id}.webp` (falling back to png/jpg if Gemini returns
 * a different mime). The loader (lib/model-gen/faces-loader.ts) tries webp,
 * png, jpg, jpeg in that order.
 *
 * Cost note (from ai-usage-tracking + observed pricing 2026-07):
 *   12 images × ~$0.045 (1K Standard) ≈ $0.54 for a clean pass. Expect
 *   1–2× iteration to reroll any faces that miss the brief.
 */
import "dotenv/config";
import { access, mkdir, rename, writeFile } from "fs/promises";
import { join } from "path";

const GEMINI_MODEL = "gemini-3.1-flash-image";
const OUT_DIR = join(process.cwd(), "public", "reference-models", "faces");

/** Duplicated from lib/model-gen/faces.ts on purpose — the script has no
 *  reason to import the runtime module, and any drift is caught by the
 *  loader (which validates against the registry).
 */
type FaceRegion = "north" | "south" | "east" | "west" | "north-east" | "global";
type FaceSex = "female" | "male";

interface FaceTarget {
  id: string;
  region: FaceRegion;
  sex: FaceSex;
}

const TARGETS: readonly FaceTarget[] = [
  // Female
  { id: "north-f-1",      region: "north",      sex: "female" },
  { id: "south-f-1",      region: "south",      sex: "female" },
  { id: "east-f-1",       region: "east",       sex: "female" },
  { id: "west-f-1",       region: "west",       sex: "female" },
  { id: "north-east-f-1", region: "north-east", sex: "female" },
  { id: "global-f-1",     region: "global",     sex: "female" },
  // Male
  { id: "north-m-1",      region: "north",      sex: "male" },
  { id: "south-m-1",      region: "south",      sex: "male" },
  { id: "east-m-1",       region: "east",       sex: "male" },
  { id: "west-m-1",       region: "west",       sex: "male" },
  { id: "north-east-m-1", region: "north-east", sex: "male" },
  { id: "global-m-1",     region: "global",     sex: "male" },
];

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const TRY_EXTS = ["webp", "png", "jpg", "jpeg"];

/**
 * Feature descriptor for a region. Model-quality is asserted separately by
 * the prompt scaffold; this only carries the visual cues (complexion, hair,
 * bone structure) that vary by region. Deliberately restrained — the goal
 * is representative regional inspiration for a fashion catalogue, not
 * stereotype. "Global" is a fair-tone international look for retailers
 * whose audience isn't India-specific.
 */
function regionDescriptor(region: FaceRegion, sex: FaceSex): string {
  const hairFem = "long silky dark hair styled naturally";
  const hairMasc = "short neatly-styled dark hair";
  const hair = sex === "female" ? hairFem : hairMasc;
  switch (region) {
    case "north":
      return `fair-to-wheatish complexion, oval face with defined cheekbones, ${hair}`;
    case "south":
      return `warm medium complexion, expressive eyes, high cheekbones, ${hair}`;
    case "east":
      return `medium complexion with soft, delicate features and refined jawline, ${hair}`;
    case "west":
      return `wheatish complexion, angular jawline, strong cheekbones, ${hair}`;
    case "north-east":
      return `medium complexion, elegant almond-shaped eyes, high cheekbones, ${sex === "female" ? "silky mid-length dark hair" : hairMasc}`;
    case "global":
      return `fair complexion, versatile international look, ${sex === "female" ? "mid-length soft brown hair" : "short neatly-styled brown hair"}`;
  }
}

/**
 * Prompt shape — the fashion-model anchor is the FIRST clause so the
 * generator prioritises "editorial model quality" over anything else, with
 * regional features arriving as descriptive detail. Head-and-shoulders, 4:5
 * (set via imageConfig, not prompt), neutral wardrobe + expression +
 * background so downstream generation isn't fighting the ref for lighting
 * or mood.
 */
function buildPrompt(target: FaceTarget): string {
  const persona = target.sex === "female"
    ? "a polished, camera-confident female fashion model"
    : "a polished, camera-confident male fashion model";
  return [
    `Editorial fashion portrait of ${persona} — a working catalogue model with the elegant bone structure, radiant natural skin and refined presence expected of a premium ethnic-wear campaign.`,
    `The model has ${regionDescriptor(target.region, target.sex)}.`,
    "Head-and-shoulders framing, subject centred, looking directly at the camera. Neutral warm expression, closed lips with a subtle smile.",
    "Wearing a plain neutral crew-neck top in a soft grey or beige — no patterns, no jewelry, no logos.",
    "Plain light-beige seamless studio background, soft even fashion-studio lighting with no harsh directional shadow.",
    "Natural skin texture, realistic tones (no exaggerated saturation), sharp focus, photorealistic.",
    "Head-and-shoulders only — no props, no accessories, no text, no watermark.",
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
  target: FaceTarget,
  apiKey: string
): Promise<{ ext: string; buffer: Buffer } | null> {
  const prompt = buildPrompt(target);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          // Portrait crop matches the Model Studio thumbnail aspect and keeps
          // the reference tight around the head — no wasted body pixels.
          imageConfig: { aspectRatio: "4:5", imageSize: "1K" },
        },
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

  const targets = only ? TARGETS.filter((t) => t.id === only) : TARGETS;
  if (targets.length === 0) {
    console.error(`No matching targets${only ? ` for --only=${only}` : ""}.`);
    process.exit(1);
  }

  console.log(`Face-library generator → ${OUT_DIR}`);
  console.log(`Model: ${GEMINI_MODEL} · targets: ${targets.length}${force ? " · force" : ""}\n`);

  let made = 0, skipped = 0, failed = 0;
  for (const target of targets) {
    // Look at all extension variants of this id so we can either skip or
    // legacy-rename ALL of them (a face may have shipped as .webp AND been
    // manually replaced with a .png — we never want two live versions).
    const presentPaths: string[] = [];
    for (const ext of TRY_EXTS) {
      const p = join(OUT_DIR, `${target.id}.${ext}`);
      if (await fileExists(p)) presentPaths.push(p);
    }

    if (presentPaths.length > 0) {
      if (!force) {
        console.log(`• ${target.id}  — exists, skipping (use --force to reroll)`);
        skipped++;
        continue;
      }
      // --force → NEVER delete/overwrite. Rename each existing variant to a
      // timestamped -legacy name so old picks stay on disk for comparison.
      // The loader (faces-loader.ts) only matches `{id}.{ext}` so legacy
      // files are inert until you rename one back.
      const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
      for (const p of presentPaths) {
        const ext = p.split(".").pop();
        const legacy = join(OUT_DIR, `${target.id}-legacy-${ts}.${ext}`);
        await rename(p, legacy);
        console.log(`  · kept previous as ${target.id}-legacy-${ts}.${ext}`);
      }
    }

    process.stdout.write(`• ${target.id}  — generating… `);
    const out = await generateOne(target, apiKey);
    if (!out) { failed++; continue; }

    await writeFile(join(OUT_DIR, `${target.id}.${out.ext}`), out.buffer);
    console.log(`saved ${target.id}.${out.ext} (${Math.round(out.buffer.length / 1024)} KB)`);
    made++;

    await new Promise((r) => setTimeout(r, 1200)); // gentle pacing
  }

  console.log(`\nDone. made=${made} skipped=${skipped} failed=${failed}`);
  if (made > 0) {
    console.log("Review each face, reroll any that miss the brief with --only=<id> --force,");
    console.log("then commit public/reference-models/faces/.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
