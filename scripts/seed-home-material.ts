/**
 * Seeds a small, hand-curated set of example wall-paint/wallpaper/texture
 * "swatches" as HmProduct rows — no retailer attached (HmRetailerProduct is
 * a separate join table; a product can exist unlisted). This is curated
 * content, not AI-generated, matching the Material Knowledge / Product DB
 * "curated, not invented" boundary in docs/home-material/README.md. Values
 * (colorHex, finish descriptions) are illustrative placeholders for testing
 * the quick-preview visualization loop — not real manufacturer SKUs.
 *
 * Each product links to a real Material Knowledge subtype (see
 * lib/home-material/material-taxonomy.ts) via materialSlug — run
 * scripts/seed-material-knowledge.ts FIRST so those rows exist (the FK
 * would otherwise fail).
 *
 * Uses upsert on a deterministic id so re-running is safe.
 *
 * Usage:
 *   npx tsx scripts/seed-material-knowledge.ts && npx tsx scripts/seed-home-material.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { recordProductEvidence } from "../lib/home-material/provenance";

type SeedProduct = {
  sku: string;
  name: string;
  materialSlug: string;
  colorName: string;
  colorHex: string;
  finish?: string;
  patternName?: string;
};

const PRODUCTS: SeedProduct[] = [
  { sku: "HM-DEMO-PAINT-001", name: "Warm Beige", materialSlug: "paint_emulsion_matte", colorName: "Warm Beige", colorHex: "#D9C7A8", finish: "matte emulsion" },
  { sku: "HM-DEMO-PAINT-002", name: "Soft Sage", materialSlug: "paint_emulsion_matte", colorName: "Soft Sage", colorHex: "#A9B99B", finish: "matte emulsion" },
  { sku: "HM-DEMO-PAINT-003", name: "Charcoal Grey", materialSlug: "paint_emulsion_sheen", colorName: "Charcoal Grey", colorHex: "#4A4A4A", finish: "silk sheen emulsion" },
  { sku: "HM-DEMO-PAINT-004", name: "Terracotta", materialSlug: "paint_emulsion_matte", colorName: "Terracotta", colorHex: "#C1683A", finish: "matte emulsion" },
  { sku: "HM-DEMO-WALLPAPER-001", name: "Botanical Leaf Wallpaper", materialSlug: "wallpaper_non_woven", colorName: "Deep Green", colorHex: "#2F4F3A", finish: "non-woven, matte", patternName: "large-scale botanical leaf" },
  { sku: "HM-DEMO-TEXTURE-001", name: "Lime Plaster Texture", materialSlug: "texture_lime_plaster", colorName: "Natural Off-White", colorHex: "#EDE6D6", finish: "textured lime plaster" },
];

async function main() {
  for (const p of PRODUCTS) {
    const materialId = `hm_material_${p.materialSlug}`;
    const material = await db.hmMaterial.findUnique({ where: { id: materialId } });
    if (!material) {
      throw new Error(`Material "${materialId}" not found — run scripts/seed-material-knowledge.ts first.`);
    }

    await db.hmProduct.upsert({
      where: { id: `seed_product_${p.sku}` },
      update: {
        name: p.name,
        colorName: p.colorName,
        colorHex: p.colorHex,
        finish: p.finish ?? null,
        patternName: p.patternName ?? null,
        materialId,
      },
      create: {
        id: `seed_product_${p.sku}`,
        sku: p.sku,
        name: p.name,
        colorName: p.colorName,
        colorHex: p.colorHex,
        finish: p.finish ?? null,
        patternName: p.patternName ?? null,
        materialId,
        availability: "unspecified",
      },
    });
    const productId = `seed_product_${p.sku}`;
    // Curated by Claude for demo/testing purposes, not a real manufacturer
    // spec — sourceType "platform" says exactly that, honestly, rather
    // than implying a manufacturer-verified fact.
    await recordProductEvidence({ productId, field: "colorName", value: p.colorName, sourceType: "platform", sourceDetail: "Curated demo content" });
    if (p.finish) await recordProductEvidence({ productId, field: "finish", value: p.finish, sourceType: "platform", sourceDetail: "Curated demo content" });
    if (p.patternName) await recordProductEvidence({ productId, field: "patternName", value: p.patternName, sourceType: "platform", sourceDetail: "Curated demo content" });

    console.log(`Upserted ${p.sku} — ${p.name} (${p.materialSlug})`);
  }

  // Clean up the old generic per-category placeholder rows from before
  // Material Knowledge existed — no longer referenced by anything once the
  // products above are re-pointed at real subtype entries.
  const stale = await db.hmMaterial.deleteMany({
    where: { id: { in: ["seed_material_paint", "seed_material_wallpaper", "seed_material_wall_texture", "seed_material_wall_panel"] } },
  });
  if (stale.count > 0) console.log(`Removed ${stale.count} stale generic placeholder material(s).`);

  console.log(`Done. ${PRODUCTS.length} demo swatches seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
