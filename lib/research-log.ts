/**
 * Append-only JSONL research log for generated images.
 *
 * Each line is a self-contained JSON object. The file lives at
 * logs/tryon-research.jsonl in the project root and is never read by the
 * application — it exists solely for offline quality analysis.
 *
 * Non-fatal: any I/O error is swallowed so logging can never break a request.
 */
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "tryon-research.jsonl");

export interface ImageMeta {
  label: string;
  mime: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
}

export interface ResearchLogEntry {
  timestamp: string;           // ISO 8601
  type: "tryon" | "model";
  productId: string;
  productTitle: string;
  productCategory: string;
  productColor: string;
  userId: string;
  outputUrl: string;           // Cloudinary URL
  generationMs: number;        // wall-clock time for Gemini call
  inputImages: ImageMeta[];
  outputImage: ImageMeta;
  tokens: {
    input: number;
    output: number;
    total: number;
  } | null;
}

export async function appendResearchLog(entry: ResearchLogEntry): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // Non-fatal
  }
}
