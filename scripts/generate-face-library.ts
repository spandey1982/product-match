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
 * Regional heritage descriptor. Anchors identity at the STATE/heritage level
 * rather than feature-listing (v2 leaned on "elegant bone structure" /
 * "high cheekbones" style words and pulled the model straight into Western
 * catalogue archetypes — see comparison in commit history). Model quality
 * is asserted subtly by the prompt scaffold, NOT by decoration here.
 *
 * Northeast carries an explicit negative — without it Gemini defaults to a
 * generic South-Asian face, which is South-Indian looking, not Northeast.
 */
function regionDescriptor(region: FaceRegion, sex: FaceSex): string {
  const hair = sex === "female"
    ? "thick long dark hair, styled naturally"
    : "short neatly-styled thick dark hair";
  switch (region) {
    case "north":
      return `from North India (Punjabi, Delhi or Uttar Pradesh heritage), warm wheatish complexion, softly rounded face, ${hair}`;
    case "south":
      return `from South India (Tamil, Kannadiga, Malayali, or Telugu heritage), warm deep-medium brown complexion, softly expressive dark eyes, ${hair}`;
    case "east":
      return `from East India (Bengali heritage), warm medium complexion, soft delicate rounded features, ${hair}`;
    case "west":
      return `from West India (Gujarati or Rajasthani heritage), warm wheatish complexion, softly rounded face, ${hair}`;
    case "north-east":
      return `from Northeast India (Assamese, Manipuri, Naga, or Meghalayan heritage), warm medium complexion, distinctive Northeast Indian facial features characteristic of the region — softly slanted almond eyes, rounded cheekbones, softer facial contours typical of people from Assam, Manipur or Nagaland. Explicitly NOT South Indian, NOT Hispanic, NOT generic international — this is specifically a Northeast Indian face, similar to Assamese or Nepali-heritage people, ${hair}`;
    case "global":
      return `with an international look (Western or European heritage), fair complexion, ${sex === "female" ? "mid-length soft brown hair" : "short neatly-styled brown hair"}`;
  }
}

/**
 * Prompt shape (v3) — Indian identity is the FIRST clause and repeats through
 * the prompt; model-quality is a subtle qualifier, not the anchor. This is
 * the correction after v2 pulled every face toward Western/Hispanic
 * archetypes by leading with "polished camera-confident model" and
 * decorating with Western-editorial vocabulary ("elegant bone structure",
 * "refined presence", "editorial"). Head-and-shoulders, 4:5 via imageConfig,
 * neutral wardrobe + expression + background so downstream generation isn't
 * fighting the ref for lighting or mood.
 */
function buildPrompt(target: FaceTarget): string {
  const subject = target.sex === "female" ? "woman" : "man";
  const isGlobal = target.region === "global";
  const anchor = isGlobal
    ? `Portrait fashion e-commerce photograph of a young ${subject}, late twenties, ${regionDescriptor(target.region, target.sex)}.`
    : `Portrait fashion e-commerce photograph of a young Indian ${subject}, late twenties, ${regionDescriptor(target.region, target.sex)}.`;
  const identityLine = isGlobal
    ? "A professional fashion model — natural, warm, catalogue-ready."
    : "A professional Indian fashion model with authentic Indian features — the warm-toned everyday Indian face of a real Indian catalogue campaign, NOT a Westernised, Hispanic, Mediterranean or generic international model.";
  return [
    anchor,
    identityLine,
    "Head-and-shoulders framing, subject centred, looking directly at the camera. Natural warm expression, closed lips with a subtle smile.",
    "Wearing a plain neutral crew-neck top in soft grey or beige — no patterns, no jewelry, no logos.",
    "Plain light-beige seamless studio background, soft even studio lighting with no harsh directional shadow.",
    "Natural warm skin tone typical of the heritage described, natural skin texture, sharp focus, photorealistic — avoid pale, cool-toned or over-defined-jawline features.",
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
