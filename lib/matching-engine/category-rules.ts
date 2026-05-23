export type CategoryPair = {
  score: number;
  label: string;
};

// Normalized category names (lowercase)
const CATEGORY_COMPATIBILITY: Record<string, Record<string, CategoryPair>> = {
  saree: {
    blouse: { score: 1.0, label: "Essential pairing" },
    jewellery: { score: 0.95, label: "Traditional styling" },
    footwear: { score: 0.85, label: "Complete ethnic look" },
    clutch: { score: 0.8, label: "Festive accessory" },
    handbag: { score: 0.7, label: "Occasion styling" },
    dupatta: { score: 0.5, label: "Style layering" },
  },
  lehenga: {
    dupatta: { score: 1.0, label: "Essential pairing" },
    jewellery: { score: 0.95, label: "Bridal styling" },
    footwear: { score: 0.85, label: "Complete bridal look" },
    clutch: { score: 0.8, label: "Festive accessory" },
    blouse: { score: 0.75, label: "Choli coordination" },
    handbag: { score: 0.6, label: "Evening accessory" },
  },
  blouse: {
    saree: { score: 1.0, label: "Essential pairing" },
    lehenga: { score: 0.75, label: "Choli coordination" },
    jewellery: { score: 0.7, label: "Traditional styling" },
  },
  dupatta: {
    lehenga: { score: 1.0, label: "Essential pairing" },
    kurta: { score: 0.9, label: "Ethnic coordination" },
    salwar: { score: 0.85, label: "Traditional set" },
    anarkali: { score: 0.8, label: "Layered styling" },
    jewellery: { score: 0.6, label: "Complementary accessory" },
  },
  kurta: {
    dupatta: { score: 0.9, label: "Ethnic coordination" },
    salwar: { score: 0.85, label: "Traditional ensemble" },
    jewellery: { score: 0.8, label: "Ethnic styling" },
    footwear: { score: 0.75, label: "Complete ethnic look" },
    handbag: { score: 0.65, label: "Casual accessory" },
  },
  salwar: {
    kurta: { score: 0.85, label: "Traditional ensemble" },
    dupatta: { score: 0.85, label: "Set completion" },
    jewellery: { score: 0.7, label: "Ethnic styling" },
  },
  anarkali: {
    dupatta: { score: 0.8, label: "Layered styling" },
    jewellery: { score: 0.9, label: "Festive styling" },
    footwear: { score: 0.8, label: "Elegant pairing" },
    clutch: { score: 0.7, label: "Evening accessory" },
  },
  sharara: {
    kurta: { score: 0.85, label: "Festive coordination" },
    jewellery: { score: 0.9, label: "Celebratory styling" },
    dupatta: { score: 0.75, label: "Layered look" },
    footwear: { score: 0.7, label: "Complete ensemble" },
  },
  palazzo: {
    kurta: { score: 0.85, label: "Modern ethnic pairing" },
    jewellery: { score: 0.7, label: "Boho styling" },
    footwear: { score: 0.75, label: "Casual chic look" },
    handbag: { score: 0.7, label: "Casual accessory" },
  },
  suit: {
    tie: { score: 1.0, label: "Classic business pairing" },
    pocket_square: { score: 0.9, label: "Formal styling detail" },
    footwear: { score: 0.85, label: "Complete formal look" },
    belt: { score: 0.8, label: "Formal coordination" },
    cufflinks: { score: 0.75, label: "Polished detail" },
    watch: { score: 0.7, label: "Power dressing" },
  },
  tie: {
    suit: { score: 1.0, label: "Classic business pairing" },
    shirt: { score: 0.9, label: "Formal coordination" },
    pocket_square: { score: 0.85, label: "Matched accessories" },
  },
  jewellery: {
    saree: { score: 0.95, label: "Traditional styling" },
    lehenga: { score: 0.95, label: "Bridal enhancement" },
    kurta: { score: 0.8, label: "Ethnic styling" },
    anarkali: { score: 0.85, label: "Festive styling" },
    sharara: { score: 0.9, label: "Celebratory styling" },
    blouse: { score: 0.7, label: "Traditional accent" },
    dupatta: { score: 0.6, label: "Layered styling" },
  },
  footwear: {
    saree: { score: 0.85, label: "Complete ethnic look" },
    lehenga: { score: 0.85, label: "Bridal finishing touch" },
    kurta: { score: 0.75, label: "Ethnic coordination" },
    anarkali: { score: 0.8, label: "Elegant pairing" },
    palazzo: { score: 0.75, label: "Casual chic" },
    sharara: { score: 0.7, label: "Festive ensemble" },
  },
  clutch: {
    saree: { score: 0.8, label: "Festive accessory" },
    lehenga: { score: 0.8, label: "Bridal accessory" },
    anarkali: { score: 0.7, label: "Evening accessory" },
    jewellery: { score: 0.6, label: "Matched accessories" },
  },
  handbag: {
    kurta: { score: 0.65, label: "Casual coordination" },
    saree: { score: 0.7, label: "Occasion styling" },
    palazzo: { score: 0.7, label: "Boho accessory" },
    sharara: { score: 0.6, label: "Festive bag" },
  },
};

export function getCategoryCompatibility(
  sourceCategory: string,
  targetCategory: string
): CategoryPair {
  const src = sourceCategory.toLowerCase().replace(/\s+/g, "_");
  const tgt = targetCategory.toLowerCase().replace(/\s+/g, "_");

  if (src === tgt) return { score: 0.1, label: "Same category" };

  // Forward lookup
  const srcRules = CATEGORY_COMPATIBILITY[src];
  if (srcRules?.[tgt]) return srcRules[tgt];

  // Reverse lookup — same as color harmony: A→B equals B→A
  const tgtRules = CATEGORY_COMPATIBILITY[tgt];
  if (tgtRules?.[src]) return tgtRules[src];

  return { score: 0.0, label: "No compatibility" };
}

export function getCompatibleCategories(category: string): string[] {
  const normalized = category.toLowerCase().replace(/\s+/g, "_");
  const rules = CATEGORY_COMPATIBILITY[normalized];
  if (!rules) return [];
  return Object.keys(rules);
}
