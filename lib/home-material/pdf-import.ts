/**
 * Structured PDF catalogue extraction (2026-09-16, reworked same day after
 * a real supplier PDF exposed two bugs — see docs/home-material/
 * architecture/system.md's "PDF extraction rework" section for the full
 * story) — the read side of the internal bulk catalogue-import tool.
 * Deliberately reads the PDF's own internal text and image objects
 * (pdfjs-dist) instead of OCR or AI vision: in a typical catalogue PDF the
 * brand logo / SKU / collection caption is a separate text layer drawn on
 * top of the product photo, not baked into its pixels, so this gets a
 * clean product image and reliable caption text for free, with zero AI
 * cost and nothing to hallucinate.
 *
 * A real page is NOT reliably "one product." A real supplier catalogue
 * page can hold a dozen-plus embedded images — a handful of real product
 * photos plus a pile of tiny logo/icon/bullet images — so this filters by
 * pixel size (MIN_PRODUCT_IMAGE_DIM) and treats every qualifying image as
 * its OWN candidate, all tagged with the page they came from. A page can
 * therefore yield zero (info/noise), one, or many product candidates.
 *
 * This module only produces CANDIDATES. Nothing here writes to HmProduct —
 * every result is reviewed, correctable, and explicitly approved by an
 * admin/catalogue manager (see app/api/admin/home-material/catalogue-
 * imports/*). "ambiguous" is a first-class outcome, not an error: it means
 * a real image was found but couldn't be turned into a usable photo
 * (decode/encode failure) — surfaced for a human to handle by hand rather
 * than silently dropped, same "never manufacture certainty" rule used
 * elsewhere in this domain (lib/home-material/wall-detection.ts).
 *
 * Processes ONE PAGE AT A TIME (openPdfImportSession + extractPage) rather
 * than the whole document in one call, so the caller (the catalogue-
 * imports API routes) can report live per-page progress and let an admin
 * stop early on a bad batch instead of blocking on the entire file with no
 * feedback — see docs/home-material/architecture/system.md.
 */
import sharp from "sharp";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// pdf.js falls back to a "fake worker" in Node (no real Worker thread) by
// dynamically import()-ing its own worker bundle relative to itself. Under
// Next's Turbopack dev/build, pdf.mjs gets relocated into a chunk directory
// that relative lookup can't resolve ("Cannot find module
// .../pdf.worker.mjs"), even though it works fine running this same module
// directly under plain Node — and Turbopack rewrites even a
// require.resolve()/createRequire() call to a synthetic virtual-module path
// instead of a real one, so that doesn't work around it either. A plain
// string path built from process.cwd() is never analyzed as a module
// specifier, so Turbopack leaves it alone — verified against Turbopack dev.
const PDFJS_DIR = path.join(process.cwd(), "node_modules/pdfjs-dist");
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(PDFJS_DIR, "legacy/build/pdf.worker.mjs")
).href;
// Real supplier PDFs commonly use JPEG2000 (JPX) compressed images, which
// needs pdf.js's OpenJPEG wasm/JS decoder. Without an explicit wasmUrl,
// resolving it fails outright in Node ("Cannot find package
// 'nullopenjpeg_nowasm_fallback.js'" — a null-concatenation bug upstream
// when wasmUrl isn't set) and every JPX image on the page silently fails
// to decode. Pointing wasmUrl at the real on-disk wasm/ directory fixes
// this — verified against a real 53-image JPX-heavy catalogue page (0
// failures with this set vs. every JPX image failing without it).
const PDFJS_WASM_URL = pathToFileURL(path.join(PDFJS_DIR, "wasm") + "/").href;

export type PdfPageType = "product" | "info" | "noise" | "ambiguous";

export interface ExtractedCandidate {
  pageNumber: number;
  pageType: PdfPageType;
  rawText: string;
  imagePng: Buffer | null;
  candidateName: string | null;
  candidateSku: string | null;
}

// A real product photo runs at least a couple hundred px on a side in
// every catalogue page sampled so far; logos/icons/bullets top out well
// under 150px. Generous margin either side of that observed gap.
const MIN_PRODUCT_IMAGE_DIM = 150;
// Below this many words, a text-only page is "noise" (blank/divider), not
// "info" (real reference content like terms/warranty/contact).
const NOISE_WORD_THRESHOLD = 8;

const SKU_LABELLED = /\bSKU\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/-]{2,})/i;
const SKU_BARE = /\b([A-Z]{1,4}-?\d{2,6}[A-Z0-9-]{0,6})\b/;

function guessSku(text: string): string | null {
  const labelled = SKU_LABELLED.exec(text);
  if (labelled) return labelled[1];
  const bare = SKU_BARE.exec(text);
  return bare ? bare[1] : null;
}

interface TextRun {
  str: string;
  fontSize: number;
}

function guessName(runs: TextRun[], knownBrand: string | null): string | null {
  const brandLower = knownBrand?.trim().toLowerCase() || null;
  const candidates = runs.filter(
    (r) => r.str.trim().length >= 2 && !/^\W+$/.test(r.str) && (!brandLower || r.str.trim().toLowerCase() !== brandLower)
  );
  if (candidates.length === 0) return null;
  // The product name is conventionally the largest-font run on the page,
  // once the repeated brand header (supplied once for the whole batch, so
  // it's known and filterable) is excluded — a real, if imperfect,
  // typographic convention across catalogue layouts. On a page with many
  // products this is only ever a shared starting hint (the same guess is
  // attached to every image candidate from that page) — the admin is
  // expected to correct it per-image in review, not a claim of precision.
  const largest = candidates.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  return largest.str.trim() || null;
}

type PdfImageObj = {
  width: number;
  height: number;
  kind: number; // pdfjsLib.ImageKind: 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP
  data?: Uint8Array | Uint8ClampedArray;
} | null;

type PdfPageProxy = Awaited<ReturnType<Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>["getPage"]>>;

// "found a real image but couldn't turn it into a usable photo" — distinct
// from "too small to be a product" (silently skipped, not ambiguous).
type ImageOutcome = { kind: "product"; png: Buffer } | { kind: "ambiguous" } | { kind: "skip" };

async function classifyPdfImage(img: PdfImageObj): Promise<ImageOutcome> {
  if (!img || !img.data) return { kind: "ambiguous" };
  if (img.width < MIN_PRODUCT_IMAGE_DIM || img.height < MIN_PRODUCT_IMAGE_DIM) return { kind: "skip" };

  let channels: 3 | 4;
  if (img.kind === pdfjsLib.ImageKind.RGB_24BPP) channels = 3;
  else if (img.kind === pdfjsLib.ImageKind.RGBA_32BPP) channels = 4;
  else return { kind: "ambiguous" }; // GRAYSCALE_1BPP is packed-bit — rare for a real photo, not worth the bit-unpacking code path

  try {
    const png = await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels } })
      .png()
      .toBuffer();
    return { kind: "product", png };
  } catch (err) {
    console.error("[pdf-import] failed to encode extracted image:", err);
    return { kind: "ambiguous" };
  }
}

/** Resolves a named XObject image, with a bounded wait — a failed decode can leave pdf.js never calling back. */
function resolvePdfImageObject(page: PdfPageProxy, name: string): Promise<PdfImageObj> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 8000);
    page.objs.get(name, (img: PdfImageObj) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    });
  });
}

async function extractPageImages(page: PdfPageProxy): Promise<ImageOutcome[]> {
  const opList = await page.getOperatorList();
  const outcomes: ImageOutcome[] = [];

  // Resolved ONE AT A TIME, deliberately: pdf.js's Node "fake worker" isn't
  // real parallelism — it's the same single-threaded decode queue either
  // way — and firing every image's request at once (tried first) made
  // genuinely-decodable images spuriously time out waiting their turn
  // behind 50+ others queued simultaneously (verified against a real
  // 58-image catalogue page: parallel produced ~45 false "ambiguous"
  // results, sequential produced the correct handful). Sequential with a
  // generous per-image timeout is both correct and fast in the common case
  // (a real page's images decode in well under a second each once the
  // JPX/wasm fix below is in place); a still-failing image only costs its
  // own page's processing time, not the whole import, since this now runs
  // page-by-page with live progress between pages.
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === pdfjsLib.OPS.paintImageXObject) {
      const name = opList.argsArray[i][0] as string;
      const img = await resolvePdfImageObject(page, name);
      outcomes.push(await classifyPdfImage(img));
    } else if (fn === pdfjsLib.OPS.paintInlineImageXObject) {
      const img = opList.argsArray[i][0] as PdfImageObj;
      outcomes.push(await classifyPdfImage(img));
    }
  }

  return outcomes;
}

export interface PdfImportSession {
  numPages: number;
  extractPage(pageNumber: number, knownBrand?: string | null): Promise<ExtractedCandidate[]>;
  destroy(): Promise<void>;
}

export async function openPdfImportSession(pdfBuffer: Buffer): Promise<PdfImportSession> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    wasmUrl: PDFJS_WASM_URL,
  });
  const doc = await loadingTask.promise;

  return {
    numPages: doc.numPages,
    async extractPage(pageNumber, knownBrand = null) {
      const page = await doc.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const runs: TextRun[] = textContent.items
          .filter((it): it is typeof it & { str: string; transform: number[] } => "str" in it && "transform" in it)
          .map((it) => ({ str: it.str, fontSize: Math.abs(it.transform[3] ?? it.transform[0] ?? 0) }));
        const rawText = runs
          .map((r) => r.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const wordCount = rawText.length === 0 ? 0 : rawText.split(/\s+/).length;

        const outcomes = await extractPageImages(page);
        const products = outcomes.filter((o) => o.kind === "product");
        const ambiguous = outcomes.filter((o) => o.kind === "ambiguous");

        if (products.length === 0 && ambiguous.length === 0) {
          return [
            {
              pageNumber,
              pageType: wordCount <= NOISE_WORD_THRESHOLD ? "noise" : "info",
              rawText,
              imagePng: null,
              candidateName: null,
              candidateSku: null,
            },
          ];
        }

        const candidateName = guessName(runs, knownBrand);
        const candidateSku = guessSku(rawText);
        const results: ExtractedCandidate[] = products.map((o) => ({
          pageNumber,
          pageType: "product",
          rawText,
          imagePng: o.kind === "product" ? o.png : null,
          candidateName,
          candidateSku,
        }));
        for (let i = 0; i < ambiguous.length; i++) {
          results.push({
            pageNumber,
            pageType: "ambiguous",
            rawText,
            imagePng: null,
            candidateName: null,
            candidateSku: null,
          });
        }
        return results;
      } finally {
        page.cleanup();
      }
    },
    async destroy() {
      await loadingTask.destroy();
    },
  };
}

/** Convenience wrapper for callers that want the whole document at once (tests, scripts) — the app itself uses openPdfImportSession page-by-page for progress/abort support. */
export async function extractPdfPages(pdfBuffer: Buffer, knownBrand: string | null = null): Promise<ExtractedCandidate[]> {
  const session = await openPdfImportSession(pdfBuffer);
  try {
    const all: ExtractedCandidate[] = [];
    for (let p = 1; p <= session.numPages; p++) {
      all.push(...(await session.extractPage(p, knownBrand)));
    }
    return all;
  } finally {
    await session.destroy();
  }
}
