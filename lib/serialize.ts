// Helpers for JSON array serialization (arrays stored as TEXT columns in Postgres)
export function serializeArray(arr: string[]): string {
  return JSON.stringify(arr);
}

export function parseArray(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: treat as comma-separated
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

// Transform a raw DB product (with JSON strings) to the typed Product
export function deserializeProduct(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    colors: parseArray(raw.colors as string),
    occasion: parseArray(raw.occasion as string),
    styleTags: parseArray(raw.styleTags as string),
    season: parseArray(raw.season as string),
    createdAt:
      raw.createdAt instanceof Date
        ? (raw.createdAt as Date).toISOString()
        : raw.createdAt,
    updatedAt:
      raw.updatedAt instanceof Date
        ? (raw.updatedAt as Date).toISOString()
        : raw.updatedAt,
  };
}

export function deserializeRecommendation(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    explanationTags: parseArray(raw.explanationTags as string),
    createdAt:
      raw.createdAt instanceof Date
        ? (raw.createdAt as Date).toISOString()
        : raw.createdAt,
    updatedAt:
      raw.updatedAt instanceof Date
        ? (raw.updatedAt as Date).toISOString()
        : raw.updatedAt,
    targetProduct: raw.targetProduct
      ? deserializeProduct(raw.targetProduct as Record<string, unknown>)
      : undefined,
  };
}
