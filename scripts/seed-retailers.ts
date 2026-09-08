/**
 * Seeds exactly ONE placeholder retailer so the lead-capture mechanism can
 * be built and tested end-to-end, without fabricating a real business
 * identity. Deliberately, clearly labeled as non-real:
 * - name says "[Demo]" and "not a real business" outright
 * - contact fields use the .invalid TLD (RFC 2606 — reserved specifically
 *   for addresses guaranteed never to resolve), not a plausible-looking
 *   fake domain
 * - isVerified stays false
 *
 * Swap this out for real retailer data whenever real partnerships exist —
 * nothing else in the codebase assumes this specific row, only that SOME
 * HmRetailer exists for HmLead.retailerId to reference.
 *
 * Usage:
 *   npx tsx scripts/seed-retailers.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { serializeArray } from "../lib/serialize";
import { recordProductEvidence } from "../lib/home-material/provenance";

const DEMO_RETAILER_ID = "hm_retailer_demo_placeholder";

// Rough, illustrative per-sqft prices for the 6 existing demo products —
// same "indicative, not verified" honesty as the material taxonomy's cost
// ranges (docs/home-material/README.md). Not from any real supplier.
const DEMO_LISTINGS: Array<{ productId: string; priceInr: number }> = [
  { productId: "seed_product_HM-DEMO-PAINT-001", priceInr: 18 },
  { productId: "seed_product_HM-DEMO-PAINT-002", priceInr: 18 },
  { productId: "seed_product_HM-DEMO-PAINT-003", priceInr: 22 },
  { productId: "seed_product_HM-DEMO-PAINT-004", priceInr: 18 },
  { productId: "seed_product_HM-DEMO-WALLPAPER-001", priceInr: 65 },
  { productId: "seed_product_HM-DEMO-TEXTURE-001", priceInr: 140 },
];

async function main() {
  const retailer = await db.hmRetailer.upsert({
    where: { id: DEMO_RETAILER_ID },
    update: {},
    create: {
      id: DEMO_RETAILER_ID,
      name: "[Demo] Sample Retailer — not a real business",
      city: "Demo",
      serviceArea: "Placeholder data for testing the lead-capture flow only.",
      categories: serializeArray(["paint", "wallpaper", "wall_texture", "wall_panel"]),
      contactPhone: null,
      contactEmail: "demo-retailer@example.invalid",
      isVerified: false,
    },
  });
  console.log(`Upserted retailer: ${retailer.name} (${retailer.id})`);

  for (const listing of DEMO_LISTINGS) {
    const product = await db.hmProduct.findUnique({ where: { id: listing.productId } });
    if (!product) {
      console.warn(`Skipping listing — product ${listing.productId} not found (seed demo products first)`);
      continue;
    }
    await db.hmRetailerProduct.upsert({
      where: { retailerId_productId: { retailerId: retailer.id, productId: listing.productId } },
      update: { priceInr: listing.priceInr, availability: "in_stock" },
      create: {
        retailerId: retailer.id,
        productId: listing.productId,
        priceInr: listing.priceInr,
        availability: "in_stock",
      },
    });
    // The price genuinely IS retailer-sourced now (this row is that
    // retailer's listing) — sourceType "retailer" is accurate here, unlike
    // the descriptive fields seeded in seed-home-material.ts (those are
    // "platform"/curated, not from any real retailer or manufacturer).
    await recordProductEvidence({
      productId: listing.productId,
      field: "priceInr",
      value: String(listing.priceInr),
      sourceType: "retailer",
      sourceDetail: retailer.name,
    });

    console.log(`Linked ${listing.productId} @ ₹${listing.priceInr}/sqft`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
