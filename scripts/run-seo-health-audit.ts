/**
 * Manual/local runner for the SEO/GEO health-score audit — see
 * lib/seo/health-score.ts for the actual logic (shared with the
 * /api/internal/seo-health-audit route, which is the one an external
 * scheduler should call in production).
 *
 * Usage:
 *   npx tsx scripts/run-seo-health-audit.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { computeHealthScore } from "../lib/seo/health-score";

async function main() {
  const breakdown = await computeHealthScore();
  const snapshot = await db.seoHealthSnapshot.create({
    data: { score: breakdown.overallScore, breakdown: JSON.stringify(breakdown) },
  });
  console.log(`Score: ${snapshot.score}/100 (snapshot ${snapshot.id})`);
  console.log(`Metadata: ${breakdown.tierA.metadataCompleteness.pct}% · Images: ${breakdown.tierA.imageCompleteness.pct}% · SKU: ${breakdown.tierA.skuCompleteness.pct}% · Collections: ${breakdown.tierA.collectionHealth.pct}%`);
  console.log(`Live smoke test: ${breakdown.tierB.ran ? `${breakdown.tierB.pagesPassed}/${breakdown.tierB.pagesChecked} pages passed` : "did not run (could not reach APP_URL)"}`);
  if (breakdown.findings.length) {
    console.log(`\n${breakdown.findings.length} finding(s):`);
    for (const f of breakdown.findings) console.log(`  [${f.severity}] ${f.message}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
