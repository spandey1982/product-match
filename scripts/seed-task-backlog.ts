/**
 * One-time population of /admin/tasks from a real codebase/docs audit
 * (deferred-work doc comments, PROJECT_KNOWLEDGE.md, docs/IMAGE_AI_ROADMAP.md
 * — see the 2026-09-04 session that added this dashboard). Every row below
 * traces to a real file/line or doc section; nothing here is invented.
 * Uses upsert on title so re-running is safe (won't duplicate), but this is
 * meant to run once — future items should be added by hand as they're found,
 * not by re-running a broadening audit script.
 *
 * Usage:
 *   npx tsx scripts/seed-task-backlog.ts
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
  // ── ai_future ──────────────────────────────────────────────────────────
  {
    title: "Retailer-facing entry UI for trial-order size field",
    description: "Product.size is a free-text field shown to shoppers on /shop's home-trial flow, but retailers have no UI to set it when adding/editing a product.",
    category: "ai_future",
    sourceRef: "prisma/schema.prisma:422-424, types/index.ts",
  },
  {
    title: "Expose store-visibility toggle in retailer Settings",
    description: "User.showOnShop (whether a retailer appears on the public /shop marketplace) is currently admin-only; intended to eventually be a retailer-facing Settings control with an admin override on top.",
    category: "ai_future",
    sourceRef: "prisma/schema.prisma:39, app/api/admin/wallets/[userId]/shop-visibility/route.ts",
  },
  {
    title: "Explicit model/person picker for Fashion Studio uploads",
    description: "The AI model shown in generated photos is auto-selected from the product today; an explicit picker UI is planned but not built.",
    category: "ai_future",
    sourceRef: "app/(dashboard)/upload/page.tsx:311-313",
  },
  {
    title: "Wire Studio backdrop generation end-to-end",
    description: "Studio backdrop is currently a store-level setting only (Phase 1) with no actual generation wiring behind it.",
    category: "ai_future",
    sourceRef: "app/(dashboard)/upload/page.tsx:337-339",
  },
  {
    title: "Add My Account / Orders navigation to the /shop customer header",
    description: "The logged-in shop header only shows identity + Sign out today — no link to account/orders because those destinations don't exist yet on the /shop side.",
    category: "ai_future",
    sourceRef: "components/layout/ShopAuthStatus.tsx:10-12",
  },
  {
    title: "Build a rental wishlist page for /rent",
    description: "The /rent try-ons view hides its wishlist banner/link because no rental wishlist page exists yet (the /shop side already has one).",
    category: "ai_future",
    sourceRef: "app/rent/my-try-ons/RentalMyTryOnsView.tsx:11",
  },
  {
    title: "Add a Kling provider adapter for catalogue motion",
    description: "Kling is a recognized future provider id in the routing logic but has no adapter implementation yet — falls back to Veo.",
    category: "ai_future",
    sourceRef: "lib/catalogue-motion/provider/index.ts",
  },
  {
    title: "Build the Phase 3 multi-shot storyboard composer",
    description: "Orchestrator + FFmpeg pan-zoom + stitching for multi-shot catalogue motion storyboards — explicitly called out as \"not yet built\" in two proof-of-concept scripts.",
    category: "ai_future",
    sourceRef: "scripts/poc-generate-motion-clip.ts, scripts/generate-saree-storyboard.ts",
  },
  {
    title: "Author the documented-but-unbuilt Scenic scene packs",
    description: "Luxury Store, Resort, Café, Street Fashion, Office, Runway, Heritage Architecture, Beach, Temple, Garden, and Studio Interior scene packs are named in the roadmap but not authored.",
    category: "ai_future",
    sourceRef: "lib/model-gen/scenes/library.ts:57-61, docs/IMAGE_AI_ROADMAP.md §12",
  },
  {
    title: "Admin-configurable category-to-provider routing",
    description: "Let admins configure which AI provider handles which product category from /settings, backed by a new RetailerSettings/RoutingRule table — today routing is hardcoded rules only.",
    category: "ai_future",
    sourceRef: "docs/IMAGE_AI_ROADMAP.md §8",
  },
  {
    title: "Progressive auto-routing signals (step 2/3)",
    description: "Auto-routing currently only implements step 1 (deterministic rules). Steps 2 (product signals: gender/material/drapeComplexity) and 3 (data-driven/learned routing) are unbuilt.",
    category: "ai_future",
    sourceRef: "lib/providers/auto-routing.ts:20-22, docs/IMAGE_AI_ROADMAP.md §8",
  },
  {
    title: "Multi-image garment decomposition for Model-Gen",
    description: "Per-garment prompt templates and selectable models for decomposed garment parts (saree pallu/blouse/drape, suit top/bottom/back, lehenga ghaghara/blouse/dupatta) — a documented but unbuilt roadmap item.",
    category: "ai_future",
    sourceRef: "docs/IMAGE_AI_ROADMAP.md §8",
  },
  {
    title: "Self-learning RAG loop over tryon-research.jsonl",
    description: "Persist prompt/result tuples and retrieve best prior prompts few-shot — documented as a planned self-learning system, not built.",
    category: "ai_future",
    sourceRef: "docs/IMAGE_AI_ROADMAP.md §8, logs/tryon-research.jsonl",
  },
  {
    title: "Migrate Backdrops + Scenic settings into /assets",
    description: "Backdrops and Scenic Collection controls currently live in Settings and are planned to migrate into the /assets area in a later pass.",
    category: "ai_future",
    sourceRef: "app/(dashboard)/assets/page.tsx:13-15",
  },
  {
    title: "Expand the Fashion Designer template library",
    description: "Templates are intentionally limited to Shirt, Trouser, and Men Suit at MVP — expand per-category over time.",
    category: "ai_future",
    sourceRef: "lib/fashion-designer/templates.ts:10-12",
  },
  {
    title: "Extend Garment Intelligence region-conditioning beyond pallu/border",
    description: "Phase 3 R&D item: thread more of Garment Intelligence's own evidence into generation-time image conditioning, currently limited to two named slots.",
    category: "ai_future",
    sourceRef: "lib/garment-intelligence/region-references.ts, lib/model-gen/strategies/catalogue.ts:117,335-336",
  },
  {
    title: "Dedicated body-type reference system for Model-Gen casting",
    description: "Body type is prompt-refined only at MVP with no dedicated reference; adding one is described as a face-library-style change.",
    category: "ai_future",
    sourceRef: "lib/model-gen/casting-types.ts:82-86",
  },
  {
    title: "Retry the dynamic OG image on Linux/Railway CI",
    description: "A next/og-based dynamic OpenGraph image was built and then dropped during the GEO/AEO work because it hit a non-deterministic \"colourspace: parameter space not set\" libvips/resvg rendering bug on this Windows dev machine (worked once, failed twice, identical code). Very likely Windows-specific — worth retrying on Railway's Linux build, or falling back to a static PNG if it recurs there too.",
    category: "ai_future",
    sourceRef: "2026-09-04 GEO/AEO session (app/opengraph-image.tsx, removed)",
  },
  {
    title: "Build the /resources content hub (blog/answers)",
    description: "A GEO/AEO content hub with real long-form articles (Article + FAQPage schema each) answering real buyer questions — the plumbing (routes, schema, JSON-LD) can be built now, but no article should be published until real source material exists.",
    category: "ai_future",
    dependencies: "Needs real case studies, stats, and quotes supplied by the retailer/business owner before any article is published — never fabricate content here.",
    sourceRef: "2026-09-04 GEO/AEO session — Roadmap Phase 3",
  },
  {
    title: "Wire Search Console / GA4 data into the SEO health snapshot",
    description: "Extend lib/seo/health-score.ts to pull indexed-page count, impressions/clicks/position, and Manual Actions (the actual Google-penalty signal) into the trend the /admin/seo-health dashboard already tracks.",
    category: "ai_future",
    dependencies: "Blocked on the user_only task \"Verify Search Console + GA4 for mentishq.com\" — needs real API credentials before this can be built.",
    sourceRef: "2026-09-04 GEO/AEO session — Roadmap Phase 4 / bucket 2",
  },
  {
    title: "Review submission + moderation UI",
    description: "The Review model exists (auto-published, no queue, by deliberate MVP default) but there's no customer-facing submission form and no admin moderation UI.",
    category: "ai_future",
    dependencies: "Needs a product decision on the moderation workflow (pre- or post-publish, who moderates, escalation path) before UI scope can be finalized.",
    sourceRef: "prisma/schema.prisma Review model, lib/reviews/aggregate.ts",
  },

  // ── user_only ──────────────────────────────────────────────────────────
  {
    title: "Wire a live payment gateway across order flows",
    description: "Every order flow (shop buy, shop trial, rental, wallet credit top-up) is mocked at \"Pay at Doorstep\" / immediate-credit with no live gateway. Razorpay integration points already exist (billing uses it for retailer subscriptions) but aren't wired into these customer-facing flows.",
    category: "user_only",
    dependencies: "Needs a business decision on rollout order (which flow goes live first) and live Razorpay credentials for each.",
    sourceRef: "lib/shop/order-types.ts:93, app/api/shop/orders/route.ts:17, lib/vto-credits/packages.ts, app/(dashboard)/billing/BillingView.tsx:621, app/(dashboard)/admin/orders/[id]/page.tsx:32",
  },
  {
    title: "Decide on and implement GST-compliant order invoicing",
    description: "Shop, trial, and rental order confirmations all explicitly state \"no invoice has been generated\" — this is a real India GST compliance feature, not a technical gap.",
    category: "user_only",
    sourceRef: "app/shop/orders/[id]/ShopOrderConfirmationView.tsx:116, ShopTrialConfirmationView.tsx:213, app/rent/orders/[id]/RentalOrderConfirmationView.tsx:211",
  },
  {
    title: "Verify nano-banana-pro cost estimate against a real GCP invoice",
    description: "The current per-image cost estimate for nano-banana-pro is an unverified approximation (unlike nano-banana-2, which was checked against a real invoice).",
    category: "user_only",
    sourceRef: "PROJECT_KNOWLEDGE.md — Erase feature section; lib/ai-usage/pricing.ts:71-72",
  },
  {
    title: "Select and wire a maps provider for store locations",
    description: "The store-location card on rental/shop product pages is a stylized SVG placeholder — no real map tiles because no maps vendor is wired up.",
    category: "user_only",
    sourceRef: "components/rental/StoreLocationCard.tsx:17-19",
  },
  {
    title: "Select and wire a customer support/chat channel",
    description: "Order cards reference \"this is where you'd reach the retailer about order #...\" but no support/chat channel is actually wired up yet.",
    category: "user_only",
    sourceRef: "components/rental/RentalOrderCard.tsx:130-132",
  },
  {
    title: "Verify Search Console + Bing Webmaster Tools for mentishq.com",
    description: "Needed to see real indexing/ranking data and, critically, Manual Actions (the actual signal for a Google penalty) — requires domain ownership verification only the account owner can complete.",
    category: "user_only",
    sourceRef: "2026-09-04 GEO/AEO session — bucket 3",
  },
  {
    title: "Set up GA4 property and share API access",
    description: "Needed for real organic-traffic and conversion trend data alongside the SEO health score.",
    category: "user_only",
    sourceRef: "2026-09-04 GEO/AEO session — bucket 3",
  },
  {
    title: "Schedule the daily SEO health-audit Railway Cron Job",
    description: "POST /api/internal/seo-health-audit exists and works (manually verified — first run scored 77/100) but nothing calls it automatically yet. Needs a Railway Cron Job configured with SEO_HEALTH_AUDIT_SECRET, which only the account owner can set up in the Railway dashboard.",
    category: "user_only",
    sourceRef: "app/api/internal/seo-health-audit/route.ts, .env.example",
  },
  {
    title: "Decide how to collect real customer reviews",
    description: "The Review/AggregateRating plumbing is dormant and ready, but manufacturing reviews would be fraud — real reviews have to come from a real collection process the business defines.",
    category: "user_only",
    sourceRef: "2026-09-04 GEO/AEO session — bucket 3",
  },
  {
    title: "Off-site authority: backlinks, press, directory listings, Google Business Profile",
    description: "G2/Capterra/Clutch listings, press coverage, and a verified Google Business Profile all need business verification and human outreach — none of this is remotely buildable.",
    category: "user_only",
    sourceRef: "2026-09-04 GEO/AEO session — bucket 3",
  },
  {
    title: "Supply real case studies/testimonials/stats for future content",
    description: "Named, permissioned customer testimonials and real usage statistics are needed before any GEO-oriented content hub article can be published.",
    category: "user_only",
    sourceRef: "2026-09-04 GEO/AEO session — bucket 3",
  },
  {
    title: "Decide rollout readiness for internal-testing-only flags",
    description: "The image-gen model chooser (upload page) and the Signature Models feature are both usable pre-flag-flip but not yet exposed to retailers generally — needs a go/no-go call.",
    category: "user_only",
    sourceRef: "app/(dashboard)/upload/page.tsx:75, app/api/model-profiles/route.ts:7-9",
  },

  // ── needs_verification ────────────────────────────────────────────────
  {
    title: "Test non-saree categories against the Garment Intelligence v3 schema",
    description: "The v3 schema's garment-agnostic fields should architecturally apply to non-saree categories but were never actually tested against them — the team's own words in PROJECT_KNOWLEDGE.md flag this as the weakest part of extraction.",
    category: "needs_verification",
    sourceRef: "PROJECT_KNOWLEDGE.md — Garment Intelligence Limitations section",
  },
  {
    title: "Gather more evidence before committing to a default ImageGenModel",
    description: "Two ImageGenModel options are held back from default use — single-sample test results aren't enough to commit to either yet.",
    category: "needs_verification",
    sourceRef: "lib/model-gen/image-gen-models.ts:43-45,55-57",
  },
  {
    title: "Audit which parts of the OTP flow are still mocked",
    description: "MSG91 is confirmed as \"the only real (non-mocked) piece of the OTP flow\" per its own file comment — implies other pieces are mocked but weren't enumerated in this pass.",
    category: "needs_verification",
    sourceRef: "lib/sms/msg91.ts:1-3",
  },
  {
    title: "Reconcile a possibly-stale rental-order doc comment",
    description: "lib/rental/order-types.ts describes rental requests as \"persisted client-side only (localStorage), not in the database,\" but RentalRequestModal's own comment says orders are now \"a real (but still mocked/no-payment) Postgres row\" — these two comments disagree and should be reconciled.",
    category: "needs_verification",
    sourceRef: "lib/rental/order-types.ts:38-41 vs components/rental/RentalRequestModal.tsx:51",
  },

  // ── blocked_external ──────────────────────────────────────────────────
  {
    title: "Wire the Veo Lite tier once Google exposes it",
    description: "The Gemini API surface doesn't yet expose a Lite tier for Veo — nothing to build until the vendor ships it.",
    category: "blocked_external",
    sourceRef: "lib/catalogue-motion/provider/veo-provider.ts:32-34",
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
  console.log(`Seeded task backlog: ${created} created, ${updated} updated (${TASKS.length} total).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
