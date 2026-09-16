/**
 * Runs extraction for exactly one PDF page and persists its candidates as
 * HmCatalogueImportPage rows — the unit of work behind POST .../catalogue-
 * imports/[id]/process-next. Shared so the initial-page-1 processing done
 * inline at upload time and every subsequent process-next call use the
 * identical logic.
 */
import { db } from "@/lib/db";
import { uploadWithRetry } from "@/lib/cloudinary";
import type { PdfImportSession } from "@/lib/home-material/pdf-import";

export async function processImportPage(
  importId: string,
  session: PdfImportSession,
  pageNumber: number,
  brand: string | null
): Promise<{ candidateCount: number }> {
  const candidates = await session.extractPage(pageNumber, brand);

  for (const candidate of candidates) {
    let extractedImageUrl: string | null = null;
    if (candidate.imagePng) {
      try {
        const b64 = candidate.imagePng.toString("base64");
        const result = await uploadWithRetry(`data:image/png;base64,${b64}`, {
          folder: "product-match/home-material/catalogue-import",
        });
        extractedImageUrl = result.secure_url;
      } catch (err) {
        console.error(`[catalogue-imports] failed to upload extracted image for page ${pageNumber}:`, err);
        // Keep the candidate even if the image upload failed — the admin
        // can still see the raw text and attach an image by hand during
        // review, rather than losing the candidate entirely.
      }
    }

    await db.hmCatalogueImportPage.create({
      data: {
        importId,
        pageNumber: candidate.pageNumber,
        pageType: candidate.pageType,
        extractedImageUrl,
        extractedFields: JSON.stringify({
          name: candidate.candidateName,
          sku: candidate.candidateSku,
          rawText: candidate.rawText,
        }),
      },
    });
  }

  return { candidateCount: candidates.length };
}
