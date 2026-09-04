import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com";

type Finding = { severity: "warning" | "info"; subject: string; message: string };
type Coverage = { passed: number; total: number; pct: number };

export type HealthBreakdown = {
  computedAt: string;
  tierA: {
    metadataCompleteness: Coverage; // active products with title + description + category + color
    imageCompleteness: Coverage; // active products with >=1 image (imageUrl/modelImageUrl/generatedImages)
    skuCompleteness: Coverage; // active products with a sku
    collectionHealth: Coverage; // ShopCollections with >=1 product
  };
  tierB: {
    ran: boolean; // false when the live-fetch tier couldn't reach APP_URL at all (e.g. local run, server not up)
    pagesChecked: number;
    pagesPassed: number;
    failures: { url: string; reason: string }[];
  };
  findings: Finding[];
  overallScore: number;
};

const MAX_FINDINGS = 50;
const SMOKE_TEST_SAMPLE_SIZE = 5;

function coverage(passed: number, total: number): Coverage {
  return { passed, total, pct: total === 0 ? 100 : Math.round((passed / total) * 100) };
}

async function runTierA() {
  const findings: Finding[] = [];

  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      id: true, title: true, description: true, category: true, color: true, sku: true,
      imageUrl: true, modelImageUrl: true,
      generatedImages: { select: { id: true }, take: 1 },
    },
  });

  let metadataPassed = 0;
  let imagePassed = 0;
  let skuPassed = 0;

  for (const p of products) {
    const hasMetadata = Boolean(p.description?.trim() && p.category && p.color);
    if (hasMetadata) metadataPassed++;
    else if (findings.length < MAX_FINDINGS) {
      findings.push({ severity: "warning", subject: `product:${p.id}`, message: `"${p.title}" is missing a description — its metadata falls back to a generated one-liner.` });
    }

    const hasImage = Boolean(p.imageUrl || p.modelImageUrl || p.generatedImages.length > 0);
    if (hasImage) imagePassed++;
    else if (findings.length < MAX_FINDINGS) {
      findings.push({ severity: "warning", subject: `product:${p.id}`, message: `"${p.title}" has no image — its Product JSON-LD image array is empty.` });
    }

    if (p.sku) skuPassed++;
    else if (findings.length < MAX_FINDINGS) {
      findings.push({ severity: "info", subject: `product:${p.id}`, message: `"${p.title}" has no SKU set.` });
    }
  }

  const collections = await db.shopCollection.findMany({ select: { id: true, name: true, productIds: true } });
  let collectionsPassed = 0;
  for (const c of collections) {
    const count = parseArray(c.productIds).length;
    if (count > 0) collectionsPassed++;
    else if (findings.length < MAX_FINDINGS) {
      findings.push({ severity: "warning", subject: `collection:${c.id}`, message: `Collection "${c.name}" has zero products — its public page would render empty.` });
    }
  }

  return {
    tierA: {
      metadataCompleteness: coverage(metadataPassed, products.length),
      imageCompleteness: coverage(imagePassed, products.length),
      skuCompleteness: coverage(skuPassed, products.length),
      collectionHealth: coverage(collectionsPassed, collections.length),
    },
    findings,
  };
}

function extractJsonLdBlocks(html: string): string[] {
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  return Array.from(matches, (m) => m[1]);
}

async function checkPage(url: string): Promise<{ url: string; reason: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { url, reason: `HTTP ${res.status}` };

    const html = await res.text();
    if (!/<title>[^<]+<\/title>/.test(html)) return { url, reason: "missing or empty <title>" };

    const blocks = extractJsonLdBlocks(html);
    if (blocks.length === 0) return { url, reason: "no application/ld+json blocks found" };
    for (const block of blocks) {
      try {
        JSON.parse(block);
      } catch {
        return { url, reason: "invalid JSON-LD (failed to parse)" };
      }
    }
    return null;
  } catch (err) {
    return { url, reason: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function runTierB(): Promise<HealthBreakdown["tierB"]> {
  const sample = await db.product.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: SMOKE_TEST_SAMPLE_SIZE,
  });

  const urls = [APP_URL, ...sample.map((p) => `${APP_URL}/shop/${p.id}`)];

  const results = await Promise.all(urls.map(checkPage));
  const failures = results.filter((r): r is { url: string; reason: string } => r !== null);

  // A total failure to reach APP_URL at all (e.g. this ran locally with no
  // dev server, or every single check errored) means the tier didn't really
  // run — don't let that silently tank the score as if pages were broken.
  const ran = failures.length < urls.length;

  return { ran, pagesChecked: urls.length, pagesPassed: urls.length - failures.length, failures };
}

export async function computeHealthScore(): Promise<HealthBreakdown> {
  const [{ tierA, findings: tierAFindings }, tierB] = await Promise.all([runTierA(), runTierB()]);

  const tierBPct = tierB.ran ? Math.round((tierB.pagesPassed / tierB.pagesChecked) * 100) : null;
  const tierBFindings: Finding[] = tierB.failures.map((f) => ({
    severity: "warning",
    subject: `page:${f.url}`,
    message: `Live check failed: ${f.reason}`,
  }));

  const overallScore = Math.round(
    0.3 * tierA.metadataCompleteness.pct +
      0.3 * tierA.imageCompleteness.pct +
      0.15 * tierA.skuCompleteness.pct +
      0.15 * tierA.collectionHealth.pct +
      0.1 * (tierBPct ?? 100) // don't punish a score for a tier that couldn't run at all
  );

  return {
    computedAt: new Date().toISOString(),
    tierA,
    tierB,
    findings: [...tierAFindings, ...tierBFindings].slice(0, MAX_FINDINGS),
    overallScore,
  };
}
