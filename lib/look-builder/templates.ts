/**
 * Look Builder — slot templates (system-controlled).
 *
 * Each anchor category maps to a blueprint of SLOTS. The system owns these
 * blueprints, so which categories can be suggested is deterministic; the
 * matching engine only ranks candidates inside a slot (see builder.ts). This is
 * the data-driven LookTemplate approach (preferred over the flat pairwise matrix)
 * confirmed for this initiative.
 *
 * Data-shaped on purpose (mirrors lib/matching-engine/category-rules.ts and
 * lib/providers/auto-routing.ts) so it can later be promoted to per-retailer
 * config or admin-edited without touching callers.
 *
 * Category coverage note: a few menswear slots (trousers / belt / blazer) point
 * at categories that are not yet in the product CATEGORIES list. Those slots
 * resolve to empty until the categories exist — graceful, future-ready. The
 * existing categories (shirt, footwear, tie, jewellery, …) work today.
 */
import type { LookTemplate } from "./types";

/** Normalize a category the same way category-rules.ts does. */
export function normalizeCategory(c: string | null | undefined): string {
  return (c ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

const TEMPLATES: LookTemplate[] = [
  // ── Menswear ───────────────────────────────────────────────────────────────
  {
    anchor: "suit",
    label: "Suit",
    slots: [
      { id: "shirt", label: "Shirt", categories: ["shirt"], required: true, max: 1 },
      { id: "footwear", label: "Shoes", categories: ["footwear"], required: true, max: 1 },
      { id: "tie", label: "Tie", categories: ["tie"], required: false, max: 1 },
      { id: "belt", label: "Belt", categories: ["belt"], required: false, max: 1 },
    ],
  },
  {
    anchor: "shirt",
    label: "Shirt",
    slots: [
      { id: "bottom", label: "Trousers", categories: ["trousers", "trouser"], required: true, max: 1 },
      { id: "footwear", label: "Shoes", categories: ["footwear"], required: true, max: 1 },
      { id: "layer", label: "Blazer", categories: ["blazer", "suit"], required: false, max: 1 },
      { id: "tie", label: "Tie", categories: ["tie"], required: false, max: 1 },
      { id: "belt", label: "Belt", categories: ["belt"], required: false, max: 1 },
    ],
  },
  {
    anchor: "tie",
    label: "Tie",
    slots: [
      { id: "shirt", label: "Shirt", categories: ["shirt"], required: true, max: 1 },
      { id: "suit", label: "Suit", categories: ["suit"], required: false, max: 1 },
    ],
  },

  // ── Womenswear / ethnic ──────────────────────────────────────────────────
  {
    anchor: "saree",
    label: "Saree",
    slots: [
      { id: "blouse", label: "Blouse", categories: ["blouse"], required: true, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
      { id: "footwear", label: "Footwear", categories: ["footwear"], required: false, max: 1 },
      { id: "bag", label: "Clutch", categories: ["clutch", "handbag"], required: false, max: 1 },
    ],
  },
  {
    anchor: "lehenga",
    label: "Lehenga",
    slots: [
      { id: "dupatta", label: "Dupatta", categories: ["dupatta"], required: true, max: 1 },
      { id: "blouse", label: "Blouse", categories: ["blouse"], required: false, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
      { id: "footwear", label: "Footwear", categories: ["footwear"], required: false, max: 1 },
      { id: "bag", label: "Clutch", categories: ["clutch", "handbag"], required: false, max: 1 },
    ],
  },
  {
    anchor: "anarkali",
    label: "Anarkali",
    slots: [
      { id: "dupatta", label: "Dupatta", categories: ["dupatta"], required: false, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
      { id: "footwear", label: "Footwear", categories: ["footwear"], required: false, max: 1 },
      { id: "bag", label: "Clutch", categories: ["clutch", "handbag"], required: false, max: 1 },
    ],
  },
  {
    anchor: "kurta",
    label: "Kurta",
    slots: [
      { id: "bottom", label: "Bottom", categories: ["salwar", "palazzo"], required: false, max: 1 },
      { id: "dupatta", label: "Dupatta", categories: ["dupatta"], required: false, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
      { id: "footwear", label: "Footwear", categories: ["footwear"], required: false, max: 1 },
    ],
  },
  {
    anchor: "sharara",
    label: "Sharara",
    slots: [
      { id: "top", label: "Kurta", categories: ["kurta"], required: false, max: 1 },
      { id: "dupatta", label: "Dupatta", categories: ["dupatta"], required: false, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
      { id: "footwear", label: "Footwear", categories: ["footwear"], required: false, max: 1 },
    ],
  },
  {
    anchor: "palazzo",
    label: "Palazzo",
    slots: [
      { id: "top", label: "Kurta", categories: ["kurta"], required: false, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
      { id: "footwear", label: "Footwear", categories: ["footwear"], required: false, max: 1 },
      { id: "bag", label: "Handbag", categories: ["handbag", "clutch"], required: false, max: 1 },
    ],
  },
  {
    anchor: "blouse",
    label: "Blouse",
    slots: [
      { id: "saree", label: "Saree", categories: ["saree"], required: true, max: 1 },
      { id: "jewellery", label: "Jewellery", categories: ["jewellery"], required: false, max: 1 },
    ],
  },
];

const TEMPLATE_BY_ANCHOR: Record<string, LookTemplate> = Object.fromEntries(
  TEMPLATES.map((t) => [t.anchor, t])
);

/** Return the look template for an anchor category, or null if none exists. */
export function getLookTemplate(
  category: string | null | undefined
): LookTemplate | null {
  return TEMPLATE_BY_ANCHOR[normalizeCategory(category)] ?? null;
}

/** True when a category can anchor a complete look. */
export function hasLookTemplate(category: string | null | undefined): boolean {
  return getLookTemplate(category) !== null;
}

/** All normalized anchor categories that have a look template. */
export function listLookAnchors(): string[] {
  return TEMPLATES.map((t) => t.anchor);
}
