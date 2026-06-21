/**
 * Canonical product categories — the single source of truth.
 *
 * Used by the upload form (create), the catalog filter (browse), and indirectly
 * by the look-builder slot templates (which reference these as candidate
 * categories). Keep this in sync with the AI extraction enum in
 * app/api/ai/extract-product/route.ts.
 *
 * Order is intentional: ethnic womenswear, then accessories, then menswear,
 * then "Other".
 */
export const PRODUCT_CATEGORIES = [
  "Saree", "Lehenga", "Blouse", "Dupatta", "Kurta",
  "Salwar", "Anarkali", "Sharara", "Palazzo",
  "Jewellery", "Footwear", "Clutch", "Handbag",
  "Suit", "Sherwani", "Tie", "Shirt", "Trousers", "Belt", "Blazer",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Catalog filter options: every real category (excluding "Other") plus "All". */
export const CATEGORY_FILTERS: string[] = [
  "All",
  ...PRODUCT_CATEGORIES.filter((c) => c !== "Other"),
];
