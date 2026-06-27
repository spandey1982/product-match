/**
 * One-off production schema sync for the libsql/Turso database.
 *
 * Why this exists: the app talks to prod via the libsql driver adapter
 * (lib/db.ts → PrismaLibSql), but `prisma migrate deploy` uses Prisma's native
 * SQLite connector, which can't apply migrations to a Turso `libsql://` URL — so
 * additive migrations never reach prod. This applies the additive columns
 * (migrations 0006–0010) directly through @libsql/client, exactly the way the
 * app connects. Idempotent: already-present columns are skipped.
 *
 * Usage (from your machine, pointing at PROD):
 *   DATABASE_URL="<prod libsql url>" TURSO_AUTH_TOKEN="<token if separate>" \
 *     npx tsx scripts/sync-prod-columns.ts
 *
 * If your prod DATABASE_URL already embeds the auth token, TURSO_AUTH_TOKEN can
 * be omitted. Safe to re-run.
 */
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Set DATABASE_URL to your PRODUCTION libsql/Turso URL first.");
  process.exit(1);
}
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

// Additive, nullable columns from migrations 0006–0010. Order doesn't matter.
const STATEMENTS: string[] = [
  `ALTER TABLE "generation_records" ADD COLUMN "modelName" TEXT`,
  `ALTER TABLE "generation_records" ADD COLUMN "width" INTEGER`,
  `ALTER TABLE "generation_records" ADD COLUMN "height" INTEGER`,
  `ALTER TABLE "generation_records" ADD COLUMN "fileSizeBytes" INTEGER`,
  `ALTER TABLE "generation_records" ADD COLUMN "aiTextureQuality" REAL`,
  `ALTER TABLE "generation_records" ADD COLUMN "aiProductVisibility" REAL`,
  `ALTER TABLE "generation_records" ADD COLUMN "aiIssues" TEXT`,
  `ALTER TABLE "products" ADD COLUMN "detailNotes" TEXT`,
  `ALTER TABLE "products" ADD COLUMN "backDetailNotes" TEXT`,
  `ALTER TABLE "products" ADD COLUMN "partImages" TEXT`,
];

function columnOf(sql: string): string {
  return sql.match(/ADD COLUMN "(\w+)"/)?.[1] ?? sql;
}

async function main() {
  const client = createClient(authToken ? { url: url!, authToken } : { url: url! });

  // Proof-of-life: count existing rows BEFORE touching anything. This raw query
  // doesn't select the missing columns, so it works even while the app can't —
  // confirming the data is intact, just unreadable until the columns are added.
  try {
    const p = await client.execute(`SELECT COUNT(*) AS n FROM products`);
    const u = await client.execute(`SELECT COUNT(*) AS n FROM users`);
    console.log(`\nDatabase contents BEFORE any change:`);
    console.log(`  products: ${p.rows?.[0]?.n}`);
    console.log(`  users:    ${u.rows?.[0]?.n}`);
    console.log(`(If these look right, your data is safe — the app just couldn't read it.)\n`);
  } catch (e) {
    console.log(`(Could not read row counts: ${(e as Error).message})\n`);
  }

  let applied = 0;
  let skipped = 0;
  for (const sql of STATEMENTS) {
    try {
      await client.execute(sql);
      console.log(`✓ added   ${columnOf(sql)}`);
      applied++;
    } catch (err) {
      const msg = (err as Error).message || "";
      if (/duplicate column|already exists/i.test(msg)) {
        console.log(`• exists  ${columnOf(sql)}`);
        skipped++;
      } else {
        console.error(`✗ FAILED  ${columnOf(sql)} — ${msg}`);
      }
    }
  }
  client.close();
  console.log(`\nDone. ${applied} added, ${skipped} already present.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
