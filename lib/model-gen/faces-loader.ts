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
import { getFace } from "./faces";

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
