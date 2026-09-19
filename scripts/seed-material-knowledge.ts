/**
 * Seeds the curated Material Knowledge taxonomy (lib/home-material/
 * material-taxonomy.ts) into HmMaterial — one row per real subtype (16
 * entries across paint/wallpaper/wall_texture/wall_panel for V1), not the
 * generic per-category placeholder rows the earlier demo-product seed used.
 *
 * Idempotent — upserts on a deterministic id derived from the taxonomy
 * entry's slug, so re-running after editing the taxonomy is safe.
 *
 * Usage:
 *   npx tsx scripts/seed-material-knowledge.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { MATERIAL_TAXONOMY } from "../lib/home-material/material-taxonomy";
import { serializeArray } from "../lib/serialize";

function idFor(slug: string): string {
  return `hm_material_${slug}`;
}

async function main() {
  for (const entry of MATERIAL_TAXONOMY) {
    const id = idFor(entry.slug);
    const data = {
      category: entry.category,
      subtype: entry.subtype,
      name: entry.name,
      description: entry.description,
      durability: entry.durability,
      maintenance: entry.maintenance,
      moistureSuitability: entry.moistureSuitability,
      installationNotes: entry.installationNotes,
      removalNotes: entry.removalNotes,
      avgCostPerSqftMinInr: entry.avgCostPerSqftMinInr,
      avgCostPerSqftMaxInr: entry.avgCostPerSqftMaxInr,
      advantages: serializeArray(entry.advantages),
      limitations: serializeArray(entry.limitations),
    };
    await db.hmMaterial.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
    console.log(`Upserted ${id} — ${entry.name}`);
  }
  console.log(`Done. ${MATERIAL_TAXONOMY.length} material knowledge entries seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
