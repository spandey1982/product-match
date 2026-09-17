/**
 * Gathers an import's non-product pages and runs the collection-level
 * extraction (lib/home-material/collection-info-extraction.ts) over their
 * combined text, saving the result to HmCatalogueImport.collectionFields.
 * Shared between the two points where an import stops receiving new
 * pages — finishing normally (process-next's `isDone` branch) and being
 * stopped early (the cancel route) — since either way, whatever reference
 * text was already found is worth extracting from.
 *
 * Deliberately broader than just pageType "info": a real info/tech page
 * (found 2026-09-17 testing a real supplier PDF) can carry a small
 * diagram or icon alongside its text, which makes the deterministic
 * pdf-import.ts classifier tag the whole page "product" (it only checks
 * "does this page have a qualifying image," not what that image shows) —
 * pageType "info" alone would silently miss it. The AI classification
 * pass already knows better (it correctly tagged that diagram "noise"),
 * so this also pulls in any "product"/"ambiguous" page whose classified
 * image role is "noise" — a real product photo (any other role) never
 * gets swept in here.
 *
 * Never throws: this is a best-effort enrichment step, not something that
 * should turn a successful import into a failed one if it errors.
 */
import { db } from "@/lib/db";
import { extractCollectionInfo } from "@/lib/home-material/collection-info-extraction";

function parseRawText(extractedFields: string): string {
  try {
    return String(JSON.parse(extractedFields)?.rawText ?? "");
  } catch {
    return "";
  }
}

function isNoiseClassified(aiClassification: string | null): boolean {
  if (!aiClassification) return false;
  try {
    return JSON.parse(aiClassification)?.role === "noise";
  } catch {
    return false;
  }
}

export async function runCollectionInfoExtraction(importId: string, userId: string): Promise<void> {
  try {
    const candidatePages = await db.hmCatalogueImportPage.findMany({
      where: { importId, pageType: { in: ["info", "product", "ambiguous"] } },
      orderBy: { pageNumber: "asc" },
      select: { pageType: true, extractedFields: true, aiClassification: true },
    });
    const infoLikePages = candidatePages.filter((p) => p.pageType === "info" || isNoiseClassified(p.aiClassification));
    if (infoLikePages.length === 0) return;

    const combinedText = infoLikePages.map((p) => parseRawText(p.extractedFields)).filter(Boolean).join("\n\n");
    if (!combinedText.trim()) return;

    const fields = await extractCollectionInfo(combinedText, userId);
    if (!fields) return;

    await db.hmCatalogueImport.update({
      where: { id: importId },
      data: { collectionFields: JSON.stringify(fields) },
    });
  } catch (err) {
    console.error(`[catalogue-imports] collection-info extraction failed for import ${importId}:`, err);
  }
}
