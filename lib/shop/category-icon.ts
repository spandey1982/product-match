import {
  Shirt, Gem, ShoppingBag, Footprints,
  type LucideIcon,
} from "lucide-react";

// Purely cosmetic — maps lib/catalog/taxonomy.ts's CATEGORIES to a
// representative lucide icon for the /shop "About" cards. Falls back to a
// generic icon for anything unmapped rather than erroring.
const ICONS: Record<string, LucideIcon> = {
  Jewellery: Gem,
  Handbag: ShoppingBag,
  Clutch: ShoppingBag,
  Footwear: Footprints,
};

export function categoryIcon(category: string): LucideIcon {
  return ICONS[category] ?? Shirt;
}
