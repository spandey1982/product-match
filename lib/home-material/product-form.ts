/**
 * Shared FormData parsing/validation for the internal catalogue tool's
 * product create/edit endpoints (app/api/admin/home-material/products/*).
 * One place for the field rules so POST (create) and PATCH (edit) can't
 * silently drift apart on what's required/valid.
 */
export const PATTERN_TYPES = ["customizable", "repeat_sheet"] as const;
export const AVAILABILITY_VALUES = ["in_stock", "order", "discontinued", "unspecified"] as const;
export const PRICE_UNITS = ["per_sqft", "per_roll", "per_panel", "per_litre"] as const;
export const REVIEW_STATUSES = ["draft", "published"] as const;

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveFloat(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw.trim()) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function triBoolean(formData: FormData, key: string): boolean | null {
  const raw = formData.get(key);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/**
 * A product with no photo can't fulfil what this platform actually does
 * (visualize it on a customer's wall) — never let one go live. A draft
 * with no image is still allowed (a real placeholder for "still need this
 * photo"), just never published. Checked at the route level (POST/PATCH),
 * not inside parseProductFormData, since "will this product end up with
 * an image" depends on the uploaded file / existing DB row, not the
 * FormData fields alone.
 */
export function requiresImageBeforePublish(reviewStatus: string, willHaveImage: boolean): string | null {
  if (reviewStatus === "published" && !willHaveImage) {
    return "This product needs a photo before it can be published — save it as a draft, or attach an image first.";
  }
  return null;
}

export interface ProductFieldData {
  materialId: string;
  name: string;
  sku: string | null;
  brand: string | null;
  collection: string | null;
  description: string | null;
  colorName: string | null;
  colorHex: string | null;
  finish: string | null;
  materialComposition: string | null;
  patternCategory: string | null;
  visualStyle: string | null;
  installationMethod: string | null;
  sampleAvailable: boolean | null;
  patternName: string | null;
  patternRepeatCm: number | null;
  orientation: string | null;
  dimensions: string | null;
  patternType: (typeof PATTERN_TYPES)[number];
  sheetWidthM: number | null;
  sheetHeightM: number | null;
  minWidthM: number | null;
  minHeightM: number | null;
  priceInr: number | null;
  priceUnit: string | null;
  warrantyInfo: string | null;
  availability: (typeof AVAILABILITY_VALUES)[number];
  reviewStatus: (typeof REVIEW_STATUSES)[number];
  familyId: string | null;
}

/**
 * Both create and edit forms always resubmit the complete field set (same
 * "edit dialog re-sends everything" convention as e.g. EditPricingButton),
 * so there's a single validation path — no partial-update ambiguity about
 * which fields a PATCH actually meant to touch.
 */
export function parseProductFormData(formData: FormData): { data: ProductFieldData } | { error: string } {
  const materialId = str(formData, "materialId");
  if (!materialId) return { error: "Select a material type" };

  const name = str(formData, "name");
  if (!name) return { error: "Product name is required" };

  const patternTypeRaw = str(formData, "patternType");
  if (!patternTypeRaw || !(PATTERN_TYPES as readonly string[]).includes(patternTypeRaw)) {
    return { error: "Select whether this is a customizable design or a repeating pattern" };
  }
  const patternType = patternTypeRaw as (typeof PATTERN_TYPES)[number];

  let sheetWidthM: number | null = null;
  let sheetHeightM: number | null = null;
  if (patternType === "repeat_sheet") {
    sheetWidthM = positiveFloat(formData, "sheetWidthM");
    sheetHeightM = positiveFloat(formData, "sheetHeightM");
    if (sheetWidthM === null || sheetHeightM === null) {
      return { error: "A repeating pattern needs its real sheet width and height (in meters)" };
    }
  }

  const availabilityRaw = str(formData, "availability");
  let availability: (typeof AVAILABILITY_VALUES)[number] = "unspecified";
  if (availabilityRaw !== null) {
    if (!(AVAILABILITY_VALUES as readonly string[]).includes(availabilityRaw)) {
      return { error: "Invalid availability value" };
    }
    availability = availabilityRaw as (typeof AVAILABILITY_VALUES)[number];
  }

  const reviewStatusRaw = str(formData, "reviewStatus");
  let reviewStatus: (typeof REVIEW_STATUSES)[number] = "draft";
  if (reviewStatusRaw !== null) {
    if (!(REVIEW_STATUSES as readonly string[]).includes(reviewStatusRaw)) {
      return { error: "Invalid review status" };
    }
    reviewStatus = reviewStatusRaw as (typeof REVIEW_STATUSES)[number];
  }

  const priceUnitRaw = str(formData, "priceUnit");
  if (priceUnitRaw !== null && !(PRICE_UNITS as readonly string[]).includes(priceUnitRaw)) {
    return { error: "Invalid price unit" };
  }

  return {
    data: {
      materialId,
      name,
      sku: str(formData, "sku"),
      brand: str(formData, "brand"),
      collection: str(formData, "collection"),
      description: str(formData, "description"),
      colorName: str(formData, "colorName"),
      colorHex: str(formData, "colorHex"),
      finish: str(formData, "finish"),
      materialComposition: str(formData, "materialComposition"),
      patternCategory: str(formData, "patternCategory"),
      visualStyle: str(formData, "visualStyle"),
      installationMethod: str(formData, "installationMethod"),
      sampleAvailable: triBoolean(formData, "sampleAvailable"),
      patternName: str(formData, "patternName"),
      patternRepeatCm: positiveFloat(formData, "patternRepeatCm"),
      orientation: str(formData, "orientation"),
      dimensions: str(formData, "dimensions"),
      patternType,
      sheetWidthM,
      sheetHeightM,
      minWidthM: positiveFloat(formData, "minWidthM"),
      minHeightM: positiveFloat(formData, "minHeightM"),
      priceInr: positiveFloat(formData, "priceInr"),
      priceUnit: priceUnitRaw,
      warrantyInfo: str(formData, "warrantyInfo"),
      availability,
      reviewStatus,
      familyId: str(formData, "familyId"),
    },
  };
}
