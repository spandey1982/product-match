/**
 * Face reference — server-side asset loader.
 *
 * Kept out of faces.ts so that client bundles (Model Studio) can import the
 * FACE_LIBRARY registry without pulling `fs/promises`. The loader reads the
 * curated portrait assets from public/reference-models/faces/ as buffers for
 * the generation pipeline. Returns null on any miss (never throws) so the
 * generation flow degrades transparently when an asset hasn't shipped yet.
 */
import { access, readFile } from "fs/promises";
import { join } from "path";
import { FACE_LIBRARY, getFace, type FaceEntry } from "./faces";

const FACES_DIR = join(process.cwd(), "public", "reference-models", "faces");
const FACE_EXTS = ["webp", "png", "jpg", "jpeg"] as const;
const EXT_MIME: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export interface FaceImage {
  buffer: Buffer;
  mime: string;
  faceId: string;
}

/**
 * Load a face reference asset as a Buffer for generation. Tries each accepted
 * extension in preference order (webp → png → jpg → jpeg). Returns null if no
 * asset exists yet — callers must degrade gracefully (fall back to the fused
 * variant reference, which behaves like today). Never throws.
 */
export async function loadFaceImage(faceId: string): Promise<FaceImage | null> {
  if (!getFace(faceId)) return null;
  for (const ext of FACE_EXTS) {
    const p = join(FACES_DIR, `${faceId}.${ext}`);
    try {
      await access(p);
      const buffer = await readFile(p);
      return { buffer, mime: EXT_MIME[ext], faceId };
    } catch {
      // try next extension
    }
  }
  return null;
}

/**
 * Check-only: return the on-disk extension for this face id, or null when
 * no asset ships yet. Skips reading the buffer — used by Model Studio to
 * render only the faces that actually exist AND to hand back the correct
 * URL (FACE_LIBRARY's thumbnailUrl assumes .webp, but the generator may
 * write .jpg/.png depending on what Gemini returns).
 */
async function assetExt(faceId: string): Promise<string | null> {
  for (const ext of FACE_EXTS) {
    try {
      await access(join(FACES_DIR, `${faceId}.${ext}`));
      return ext;
    } catch {
      // try next extension
    }
  }
  return null;
}

/**
 * Return the subset of FACE_LIBRARY whose portrait assets are actually on
 * disk. Each returned entry has its `thumbnailUrl` overridden to the real
 * on-disk extension so the browser fetches the file that exists, not the
 * .webp the registry hardcodes. Model Studio calls this so the picker
 * shows N cards when N faces ship — not 12 gradient-only placeholders.
 * Order is preserved from FACE_LIBRARY (female group before male group).
 * Runs once per page load.
 */
export async function listAvailableFaces(): Promise<FaceEntry[]> {
  const results = await Promise.all(
    FACE_LIBRARY.map(async (f) => ({ f, ext: await assetExt(f.id) }))
  );
  return results
    .filter((r): r is { f: FaceEntry; ext: string } => r.ext !== null)
    .map(({ f, ext }) => ({ ...f, thumbnailUrl: `/reference-models/faces/${f.id}.${ext}` }));
}
