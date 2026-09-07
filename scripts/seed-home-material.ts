/**
 * Seeds a small, hand-curated set of example wall-paint/wallpaper/texture
 * "swatches" as HmProduct rows — no retailer attached (HmRetailerProduct is
 * a separate join table; a product can exist unlisted). This is curated
 * content, not AI-generated, matching the Material Knowledge / Product DB
 * "curated, not invented" boundary in docs/home-material/README.md. Values
 * (colorHex, finish descriptions) are illustrative placeholders for testing
 * the quick-preview visualization loop — not real manufacturer SKUs.
 *
 * Uses upsert on sku so re-running is safe.
 *
 * Usage:
 *   npx tsx scripts/seed-home-material.ts
 */
import "dotenv/config";
import { db } from "../lib/db";

type SeedProduct = {
  sku: string;
  name: string;
  category: "paint" | "wallpaper" | "wall_texture" | "wall_panel";
  colorName: string;
  colorHex: string;
  finish?: string;
  patternName?: string;
};

const PRODUCTS: SeedProduct[] = [
  { sku: "HM-DEMO-PAINT-001", name: "Warm Beige", category: "paint", colorName: "Warm Beige", colorHex: "#D9C7A8", finish: "matte emulsion" },
  { sku: "HM-DEMO-PAINT-002", name: "Soft Sage", category: "paint", colorName: "Soft Sage", colorHex: "#A9B99B", finish: "matte emulsion" },
  { sku: "HM-DEMO-PAINT-003", name: "Charcoal Grey", category: "paint", colorName: "Charcoal Grey", colorHex: "#4A4A4A", finish: "eggshell emulsion" },
  { sku: "HM-DEMO-PAINT-004", name: "Terracotta", category: "paint", colorName: "Terracotta", colorHex: "#C1683A", finish: "matte emulsion" },
  { sku: "HM-DEMO-WALLPAPER-001", name: "Botanical Leaf Wallpaper", category: "wallpaper", colorName: "Deep Green", colorHex: "#2F4F3A", finish: "non-woven, matte", patternName: "large-scale botanical leaf" },
  { sku: "HM-DEMO-TEXTURE-001", name: "Lime Plaster Texture", category: "wall_texture", colorName: "Natural Off-White", colorHex: "#EDE6D6", finish: "textured lime plaster" },
];

async function main() {
  for (const p of PRODUCTS) {
    const material = await db.hmMaterial.upsert({
      where: { id: `seed_material_${p.category}` },
      update: {},
      create: {
        id: `seed_material_${p.category}`,
        category: p.category,
        subtype: p.category,
        name: p.category.replace("_", " "),
      },
    });

    await db.hmProduct.upsert({
      where: { id: `seed_product_${p.sku}` },
      update: {
        name: p.name,
        colorName: p.colorName,
        colorHex: p.colorHex,
        finish: p.finish ?? null,
        patternName: p.patternName ?? null,
        materialId: material.id,
      },
      create: {
        id: `seed_product_${p.sku}`,
        sku: p.sku,
        name: p.name,
        colorName: p.colorName,
        colorHex: p.colorHex,
        finish: p.finish ?? null,
        patternName: p.patternName ?? null,
        materialId: material.id,
        availability: "unspecified",
      },
    });
    console.log(`Upserted ${p.sku} — ${p.name}`);
  }
  console.log(`Done. ${PRODUCTS.length} demo swatches seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
