import { formatLabel } from "./format";

/** Short heuristic descriptor for a material name, based on common fabric keywords. */
export function materialDescriptor(material?: string | null): string | null {
  if (!material) return null;
  const m = material.toLowerCase();
  if (/net|chiffon|georgette|organza|tulle/.test(m)) return "Lightweight • Sheer";
  if (/silk|satin|tussar/.test(m)) return "Rich • Lustrous";
  if (/cotton|linen|khadi/.test(m)) return "Breathable • Soft";
  if (/velvet/.test(m)) return "Plush • Warm";
  if (/brocade|jacquard/.test(m)) return "Textured • Ornate";
  if (/denim/.test(m)) return "Sturdy • Casual";
  if (/wool/.test(m)) return "Warm • Cozy";
  return "Premium Quality";
}

/** Derived from the real occasion list — not fabricated, just a short summary phrase. */
export function occasionDescriptor(occasions: string[]): string | null {
  if (occasions.length === 0) return null;
  const hasCelebration = occasions.some((o) =>
    /wedding|festive|reception|bridal|celebration|engagement|sangeet/i.test(o)
  );
  return hasCelebration ? "Celebration Ready" : "Everyday Ready";
}

/** Falls back to the platform's broad taxonomy when no subcategory is set. */
export function categoryDescriptor(category: string, subcategory?: string | null): string | null {
  if (subcategory && subcategory.trim()) return formatLabel(subcategory);
  const c = category.toLowerCase();
  if (/lehenga|saree|sari|kurta|kurti|salwar|sherwani|blouse|dupatta|anarkali|churidar/.test(c)) {
    return "Ethnic Wear";
  }
  if (/shirt|trouser|jeans|dress|jacket|suit|t-shirt|tshirt|skirt/.test(c)) {
    return "Western Wear";
  }
  return "Fashion Apparel";
}

/** styleTags[0] becomes the headline value; the rest become the supporting descriptor. */
export function styleValue(styleTags: string[]): { value: string; descriptor: string | null } {
  if (styleTags.length === 0) return { value: "—", descriptor: null };
  const [first, ...rest] = styleTags;
  return {
    value: formatLabel(first),
    descriptor: rest.length > 0 ? rest.map(formatLabel).join(" • ") : null,
  };
}
