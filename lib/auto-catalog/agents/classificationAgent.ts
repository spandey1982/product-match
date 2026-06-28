import { analyzeProductImage } from "@/lib/metadata/analyze";
import { CLASSIFICATION_THRESHOLD, type ClassificationResult } from "../types";

/**
 * Classification Agent — identifies product category and confidence from an
 * image URL. Fetches the image, calls the shared metadata service, and returns
 * a structured classification result.
 */
export async function classificationAgent(
  imageUrl: string,
  userId: string
): Promise<ClassificationResult> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";

  const result = await analyzeProductImage(buffer, mimeType, { userId });
  if (!result.ok) throw new Error(result.error);

  const { metadata } = result;

  // Estimate confidence: "Other" category signals low confidence
  const isOther = metadata.category === "Other";
  const confidence = isOther ? 0.3 : 0.85;

  return {
    category: metadata.category,
    confidence,
    // Group key — for now each image is its own product; future: image similarity grouping
    groupId: crypto.randomUUID(),
  };
}

export function isBelowThreshold(confidence: number): boolean {
  return confidence < CLASSIFICATION_THRESHOLD;
}
