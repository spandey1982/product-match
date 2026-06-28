import { analyzeProductImage } from "@/lib/metadata/analyze";
import type { CatalogResult } from "../types";

/**
 * Catalog Agent — generates full product metadata with per-field confidence
 * scores from an image URL and known category.
 */
export async function catalogAgent(
  imageUrl: string,
  category: string,
  userId: string
): Promise<CatalogResult> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";

  const result = await analyzeProductImage(buffer, mimeType, { userId }, category);
  if (!result.ok) throw new Error(result.error);

  const { metadata } = result;

  // Assign confidence scores based on field completeness
  const conf = (value: string | number | string[], base: number) => {
    const empty =
      value === "" || value === 0 || (Array.isArray(value) && value.length === 0);
    return empty ? Math.max(0.3, base - 0.3) : base;
  };

  return {
    title:       { value: metadata.title,       confidence: conf(metadata.title, 0.9) },
    description: { value: metadata.description, confidence: conf(metadata.description, 0.85) },
    category:    { value: metadata.category,    confidence: 0.95 },
    subcategory: { value: metadata.subcategory, confidence: conf(metadata.subcategory, 0.8) },
    color:       { value: metadata.color,       confidence: conf(metadata.color, 0.92) },
    pattern:     { value: metadata.pattern,     confidence: conf(metadata.pattern, 0.85) },
    material:    { value: metadata.material,    confidence: conf(metadata.material, 0.82) },
    gender:      { value: metadata.gender,      confidence: 0.9 },
    occasion:    { value: metadata.occasion,    confidence: conf(metadata.occasion, 0.8) },
    styleTags:   { value: metadata.styleTags,   confidence: conf(metadata.styleTags, 0.78) },
    season:      { value: metadata.season,      confidence: conf(metadata.season, 0.75) },
    price:       { value: metadata.price,       confidence: conf(metadata.price, 0.7) },
  };
}
