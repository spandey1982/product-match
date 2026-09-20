/**
 * M3 verification — generates a real script via Gemini for a handful of
 * real products (diverse categories) and prints the result for review.
 * Kept on disk, rerunnable.
 *
 * Usage: npx tsx scripts/verify-script-generator.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { generatePresenterScript } from "../lib/presenter-reel/script-generator";

const PRODUCT_IDS = [
  "cms1dg64500avaclbxgl44sdb", // Men's Burgundy Suit (solid)
  "cmsiy1d3y015zp8lbos2spmve", // Peach Embroidered Saree with Golden Border
  "cmtbhjqri0002aslbf17t0z81", // Mint Green Embroidered Lehenga Set
];

async function main() {
  for (const id of PRODUCT_IDS) {
    const product = await db.product.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true, category: true, color: true, material: true, pattern: true, detailNotes: true, occasion: true, price: true },
    });
    if (!product) {
      console.log(`SKIP ${id}: not found`);
      continue;
    }
    const script = await generatePresenterScript(product, { feature: "presenter_reel", userId: product.userId });
    console.log(`\n=== ${product.title} ===`);
    console.log(`Script: "${script}"`);
    console.log(`Word count: ${script.split(/\s+/).length}`);
  }
}

main().finally(() => db.$disconnect());
