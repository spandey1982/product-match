import { analyzeProductImage } from "@/lib/metadata/analyze";
import { CLASSIFICATION_THRESHOLD, type ClassificationResult } from "../types";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

/**
 * Classification Agent — identifies product category and confidence from an
 * image URL. Fetches the image, calls the shared metadata service, and returns
 * a structured classification result.
 *
 * Retries up to MAX_ATTEMPTS times on transient errors (rate limits, 5xx)
 * before throwing so the pipeline can mark the item failed.
 */
export async function classificationAgent(
  imageUrl: string,
  userId: string
): Promise<ClassificationResult> {
  // Fetch the image once — no point re-fetching on every retry
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status} ${imageUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";

  let lastError = "Analysis failed after retries";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await analyzeProductImage(buffer, mimeType, { userId });

    if (result.ok) {
      const { metadata } = result;
      const isOther = metadata.category === "Other";
      const confidence = isOther ? 0.3 : 0.85;
      return {
        category: metadata.category,
        confidence,
        groupId: crypto.randomUUID(),
      };
    }

    lastError = result.error ?? "Unknown analysis error";

    // Don't retry on auth / credential errors — they won't fix themselves
    const isTerminal = result.status === 503 && lastError.includes("credentials");
    if (isTerminal || attempt === MAX_ATTEMPTS) break;

    // Transient: wait before retrying
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
  }

  throw new Error(`Classification failed: ${lastError}`);
}

export function isBelowThreshold(confidence: number): boolean {
  return confidence < CLASSIFICATION_THRESHOLD;
}
