/**
 * Find a product with a "front" catalogue image, suitable for the Phase 2
 * live Veo POC. Read-only. Delete after use.
 */
import "dotenv/config";
import { db } from "../lib/db";

async function main() {
  const candidates = await db.product.findMany({
    where: {
      isActive: true,
      generatedImages: { some: { view: "front" } },
    },
    select: {
      id: true,
      title: true,
      category: true,
      generatedImages: { where: { view: { in: ["front", "back"] } }, select: { view: true, url: true } },
    },
    take: 5,
    orderBy: { updatedAt: "desc" },
  });

  for (const p of candidates) {
    console.log(`\nid=${p.id}`);
    console.log(`title=${p.title}`);
    console.log(`category=${p.category}`);
    for (const img of p.generatedImages) {
      console.log(`  ${img.view}: ${img.url}`);
    }
  }
  if (candidates.length === 0) console.log("No products found with a front catalogue image.");
  process.exit(0);
}

main();
