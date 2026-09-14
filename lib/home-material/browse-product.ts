// Shared shape for a curated/public product on the browse grid — used by
// the server fetch (app/materials/page.tsx), the landing client, the new
// shop-parity browse section, and the product card, so it has one home
// instead of being re-declared per file (2026-09-14 browse-parity work).
export type BrowseProduct = {
  id: string;
  name: string;
  colorHex: string | null;
  finish: string | null;
  patternName: string | null;
  textureAssetUrl: string | null;
  category: string | null;
  subtype: string | null;
  collection: string | null;
  durabilityYearsApprox: number | null;
  maintenanceLevel: string | null;
  priceInr: number | null;
  priceIsExact: boolean;
  costRangeMinInr: number | null;
  costRangeMaxInr: number | null;
};
