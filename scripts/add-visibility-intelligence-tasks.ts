/**
 * One-off addition to /admin/tasks — new gaps surfaced by the Sept 2026
 * "Mentis Visibility Intelligence" strategic assessment (full assessment:
 * see PROJECT_KNOWLEDGE.md's "AI discoverability / GEO-AEO-SEO strategy"
 * section for the artifact link). Per scripts/seed-task-backlog.ts's own
 * doc comment, future items get added by hand as they're found rather than
 * by re-running that broadening audit script — this is that hand-add, dated
 * and traceable rather than a throwaway edit. Upserts on title, safe to
 * re-run.
 *
 * Usage:
 *   npx tsx scripts/add-visibility-intelligence-tasks.ts
 */
import "dotenv/config";
import { db } from "../lib/db";

type SeedTask = {
  title: string;
  description: string;
  category: "ai_future" | "user_only" | "needs_verification" | "blocked_external";
  dependencies?: string;
  sourceRef?: string;
};

const TASKS: SeedTask[] = [
  {
    title: "Business/brand profile data model",
    description: "No fields exist anywhere for business positioning, USP, target audience, named competitors, Google Business Profile id, or social media handles. This blocks query intelligence, competitor intelligence, and local-visibility measurement — all of them need it as an input.",
    category: "ai_future",
    sourceRef: "2026-09-07 Mentis Visibility Intelligence assessment §5, §25",
  },
  {
    title: "Emit LocalBusiness structured data",
    description: "storeCity/storeAddress already exist on User, but zero pages emit LocalBusiness/GeoCoordinates/openingHours JSON-LD. Low-risk, same pattern as the existing Organization/Product JSON-LD.",
    category: "ai_future",
    sourceRef: "2026-09-07 assessment §5, §15",
  },
  {
    title: "Resolve the 'MCP server setup' pricing claim",
    description: "Sold on the Enterprise tier (app/HomeClient.tsx) with zero backing code anywhere in the repo — written into pricing copy 2026-06-23, 2.5 months before any real SEO/GEO work started, never touched since. Agentic-commerce protocols are real but still early (ACP's own flagship consumer product, ChatGPT Instant Checkout, was retired March 2026 after ~12 merchants) — building a bespoke MCP server now would be a bet on an immature market, not a quick fix.",
    category: "user_only",
    dependencies: "Founder decision: build it for real, or remove the claim from pricing copy.",
    sourceRef: "2026-09-07 assessment §3, §16",
  },
  {
    title: "Resolve the 'SEO & AEO optimization' tier-gating mismatch",
    description: "Sold as a Business/Enterprise-tier differentiator, but every retailer on every tier already gets the identical robots/sitemap/JSON-LD/health-score treatment — nothing in code gates it by plan.",
    category: "user_only",
    dependencies: "Founder decision: implement real tier-gating, or stop selling it as a tier differentiator.",
    sourceRef: "2026-09-07 assessment §3",
  },
  {
    title: "Product feed / Google Merchant Center export",
    description: "No XML/JSON product feed exists. Industry reporting + Google Marketing Live 2026 announcements indicate a live Merchant Center feed (not just page-level Product schema) is becoming a prerequisite for appearing in AI Shopping (AI Mode/Gemini) transactional answers.",
    category: "ai_future",
    sourceRef: "2026-09-07 assessment §10 (evidence table), §16",
  },
  {
    title: "Query intelligence engine",
    description: "Nobody generates the set of real questions a retailer's customers actually ask AI systems (brand/category/recommendation/commercial/price/local/product/occasion queries). Genuinely proprietary if built from Mentis's existing structured product data rather than generic keyword tooling.",
    category: "ai_future",
    dependencies: "Needs the business/brand profile data model (named competitors, target audience) as an input first.",
    sourceRef: "2026-09-07 assessment §20",
  },
  {
    title: "AI-engine visibility measurement (Phase 1 foundation)",
    description: "Nothing queries ChatGPT/Perplexity/Gemini/AI Overviews to see how a retailer or product is actually represented. Must be built around repeated, multi-variant sampling from day one (query x platform x city x phrasing x timestamp) — a single test query is not credible evidence, per the volatility research in the assessment.",
    category: "ai_future",
    dependencies: "Needs the business-profile data model, the query intelligence engine, and a decision on which retailers pilot it and who absorbs the AI API cost.",
    sourceRef: "2026-09-07 assessment §17, §18, roadmap Phase 1",
  },
  {
    title: "Competitor intelligence (business-level)",
    description: "No business-level competitor tracking exists — the only 'competitor' references in the codebase today are internal photo-quality benchmarking against one rival's product photography, not a business-intelligence feature.",
    category: "ai_future",
    dependencies: "Needs named competitors on the business profile, and the visibility-measurement foundation to run the same query set against them.",
    sourceRef: "2026-09-07 assessment §12, §21",
  },
  {
    title: "AI Perception Monitor (factual-accuracy checking)",
    description: "Test whether AI systems describe a retailer's business type, location, and offerings correctly. Domain-specific hallucination research shows ungrounded LLM answers on niche/long-tail entities can be wrong at meaningfully higher rates than general knowledge — SMB retailers are plausibly in that higher-risk band, but the actual rate has to be measured per retailer, not assumed.",
    category: "ai_future",
    dependencies: "Part of the Phase 1 measurement foundation — not a separate build.",
    sourceRef: "2026-09-07 assessment §10 (evidence table), §17",
  },
  {
    title: "Product-level AI visibility testing",
    description: "Test whether AI systems correctly associate a specific product's real attributes (category, color, occasion, material, price, availability) when asked — not just whether the brand is mentioned. No AI-visibility vendor in the current competitive set measures at this granularity; it's the differentiation candidate this assessment found, and only possible because Mentis already extracts this metadata per product.",
    category: "ai_future",
    dependencies: "Needs the Phase 1 measurement foundation to exist first.",
    sourceRef: "2026-09-07 assessment §14, §27",
  },
  {
    title: "Controlled experimentation framework (control/treatment AI-visibility testing)",
    description: "Run a matched control and treatment (e.g. two comparable products/pages, one changed), measure both with the same repeated-query methodology, and report the delta rather than an unqualified before/after on the treatment alone. No AI-visibility vendor found in this category does this — they report trend lines, not designed experiments. This is a later-phase item, not part of the initial measurement build.",
    category: "ai_future",
    dependencies: "Needs Phase 1 (measurement) and Phase 2 (scoring/competitor intelligence) to be live first — this is Phase 4 in the assessment's roadmap.",
    sourceRef: "2026-09-07 assessment §23, §28, roadmap Phase 4",
  },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const task of TASKS) {
    const existing = await db.taskItem.findFirst({ where: { title: task.title } });
    if (existing) {
      await db.taskItem.update({
        where: { id: existing.id },
        data: { description: task.description, category: task.category, dependencies: task.dependencies, sourceRef: task.sourceRef },
      });
      updated++;
    } else {
      await db.taskItem.create({ data: task });
      created++;
    }
  }
  console.log(`Added visibility-intelligence tasks: ${created} created, ${updated} updated (${TASKS.length} total).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
