# Home Material Intelligence Platform — Domain Brief

Status: **Fast-lane demo pivot (2026-09-07)** — see that section below
before anything else; it changes what's active vs. paused relative to the
original V1 plan. This is the anchor doc for this domain;
read it before re-deriving architecture context in a future session (see
CLAUDE.md §6). It intentionally stays lightweight — not the full docs/
hierarchy sketched in the original discovery brief — until there's enough
real code to justify splitting it.

This product is a **separate domain** from the rest of Product Match (the
Indian ethnic-fashion retailer SaaS). It must not inherit fashion/garment
taxonomy, prompts, schemas, or business rules. It may share generic
infrastructure — see "What's shared" below.

---

## Product thesis

> Make better material decisions before you spend money on your home.
> See it. Understand it. Compare it. Buy it.

Understand → Explore → Visualize → Compare → Validate → Decide → Source.

Visualization is one capability, not the product. The long-term moat is
accumulated structured material/product/decision data, not any one AI
model — architecture should treat AI providers as replaceable.

## V1 scope (locked)

- **Surface**: walls only.
- **Materials**: paint, wallpaper, wall texture, wall panels.
- **Geography**: India-first; currency/units/terminology/retailer-discovery
  are config, not hardcoded into core domain logic.
- **Two customer modes**: "I know what I want" (product-accurate path) vs.
  "help me choose" (requirement-driven recommendation path).
- **Two visualization fidelities**: quick AI preview (exploratory, freer
  generative interpretation) vs. product-accurate preview (preserves real
  product colour/pattern/scale/repeat + everything else in the room).
- **Commerce model**: consumer-first experience + retailer catalogue/lead
  backend. Not a marketplace — no checkout/payment/logistics in V1.
- Not in V1: floors, tiles, kitchens, bathrooms, countertops, furniture,
  contractor/installer tooling, self-serve retailer onboarding.

## Fast-lane demo pivot (2026-09-07)

**Decision (LOCKED):** pause breadth-first V1 buildout in favor of getting
one path fully demo-ready: upload a straight-on wall photo → AI detects the
wall → pick a swatch → generate a real preview. Reason: the first
end-to-end test proved the mechanism but wasn't "a proper visual" — the
priority became showing something convincing to potential customers, not
completing every V1 section in parallel. This is a **sequencing change,
not a scope-cut** — nothing below is removed from the plan, see "paused"
list.

**✅ V1 plan items now addressed by this pivot** (were planned, now real):
- Core V1 journey, "I know what I want" path (brief §8, §16): Upload Room →
  Select Wall → Actual Product → Visualize is now real end-to-end, with a
  curated swatch set standing in for retailer inventory (see "flagged"
  below for the gap that leaves).
- Constitution Principle 6 ("visualization is not measurement") and
  Principle 4 ("never manufacture certainty") are now exercised for real,
  not just schema-shaped: `HmSurface.measurementSource="ai_estimated"` is
  actually set by AI detection now, and `detectWallRegion` returns
  `wallVisible:false` rather than guessing when no clear wall is visible.

**✅ Future-roadmap item pulled forward (brief §15, partially — not fully
complete):** the **Computer Vision** AI-boundary component
(`lib/home-material/wall-detection.ts`) — was explicitly deferred as future
work in the original discovery response; now implemented, but **narrowly**
(see "flagged" below — this is not the general room/multi-wall
understanding §15 and §23 describe, just a single-wall bounding box for a
constrained photo).

**🆕 New addition, worth keeping long-term (update to the plan):**
guided capture UX — asking the user to stand facing the wall, straight-on,
before uploading — is a real, worthwhile product pattern (comparable
products in the Inspiration Register-adjacent space use similar guided
capture for reliability), not just a fast-lane hack. Keep this as the
recommended capture flow even after general-purpose CV is built; it
improves detection reliability regardless of how sophisticated the CV
gets.

**⚠️ Flagged — fast-lane shortcuts, NOT the long-term design, revisit
before real launch:**
- **Wall detection is single-wall, front-on only.** It will not handle
  angled shots, multiple visible walls, or heavy occlusion — real V1 (per
  the original brief's CV section) needs the fuller room/surface
  understanding this intentionally skips. Treat `wall-detection.ts` as a
  first CV increment, not the final implementation.
- **The swatch catalog is 6 hand-picked demo colors/patterns
  (`scripts/seed-home-material.ts`), not real retailer inventory** — no
  pricing, no real availability, `availability: "unspecified"`. Fine for a
  demo; violates Principle 7 ("product database defines the product") as a
  real launch catalogue. Already self-documented in the seed script, worth
  restating here.
- **Visualization quality is still unvalidated on a real photo** — the
  mask/composite pipeline (`lib/home-material/visualization.ts`) was only
  proven against a synthetic test image so far. Resolution/feathering
  parameters may need tuning once real-photo results come in; don't assume
  today's settings are final.
- **Room-photo privacy policy is still an open gap** (see "Open/deferred"
  below) — now more urgent, not less, since real photos of real homes are
  about to be used for actual customer demos.

**Paused, not abandoned** (still in the plan, just not being built right
now): Material Knowledge content, the deterministic Recommendation Engine
("help me choose" mode), Product-Accurate visualization mode (tied to a
real retailer SKU with provenance), Retailer/Lead capture, self-serve
retailer onboarding. Resume these once the fast-lane demo path is
validated with real photos and real feedback.

## Locked decisions (2026-09-07)

| Decision | Choice | Why |
|---|---|---|
| Consumer identity | New dedicated table (`HmUser`), not `Customer` | Keeps domains separable per the "shared infra, not shared domain logic" rule; `Customer` carries fashion-commerce fields (tryOnCredits, ShopOrder/Wishlist relations) that don't belong here |
| Retailer side | New `HmRetailer` model, **admin-seeded only for V1** | No self-serve onboarding yet; mirrors how `ShopCollection` is admin-curated today; keeps the existing fashion `User` (retailer) model untouched |
| Top-level route | `/materials` | Scope-neutral — won't need renaming as Phase 2/3 add flooring, tiles, kitchens, etc. (unlike `/walls`, which is scoped to V1 and would force an SEO-costly rename later) |
| Auth mechanism | Reuse the OTP-over-cookie *pattern* (`lib/customer-auth.ts`), new cookie names, no DB table for pending OTP | Proven, stateless, cheap; the pattern is generic infra even though the identity table isn't |
| Schema location | New models appended to the existing `prisma/schema.prisma`, `hm_` table prefix | Matches how this repo already holds many unrelated domains in one schema file; avoids the overhead of a second datasource for no real benefit at this scale |

## What's shared vs. domain-specific

**Shared (generic infra, reuse as-is):**
`lib/db.ts` (single Prisma client), `lib/serialize.ts`'s `serializeArray`/
`parseArray` primitives (not `deserializeProduct`/`deserializeRecommendation`
— those are hardcoded to the fashion `Product` shape), Cloudinary client,
pg-boss/worker queue infra, `components/ui` primitives, the `AiUsageEvent`
cost ledger (new `feature` values, e.g. `"hm_visualization"`,
`"hm_room_analysis"` — the column is already free-text), admin `TaskItem`
backlog.

**Not shared (fashion-domain IP, never touched or imported by this domain):**
`lib/matching-engine/*` (protected — CLAUDE.md §4), `lib/garment-intelligence/*`,
`lib/fashion-designer/*`, `lib/model-gen/*`, `lib/catalogue-motion/*`, the
`Product`/`Recommendation`/`ShopOrder`/`RentalOrder`/`Customer`/
`ClientProfile`/`User` models and their business logic.

**Architecturally inspired by, but independently implemented:**
- Deterministic scorer + explainer split (`lib/matching-engine/scorer.ts` +
  `explainer.ts`) → this domain's own recommendation engine. No code reuse
  — the weights/rules are entirely different (material suitability, not
  garment cross-sell) and the fashion scorer is protected IP.
- "Structured JSON, not prose" + "absence is information, never invent it"
  (Garment Intelligence's hard-won lessons, see root `PROJECT_KNOWLEDGE.md`)
  → `lib/home-material/wall-detection.ts`'s CV output shape: structured
  JSON only (`responseMimeType: "application/json"`), and an explicit
  `wallVisible: false` rather than a guessed box when nothing clear is
  visible.
- Deterministic post-generation mask compositing (`lib/model-gen/erase.ts`)
  → `lib/home-material/visualization.ts` uses the same technique for
  guaranteeing "preserve the room" (Constitution Principle 2): don't trust
  the model to respect a mask boundary, composite the edit against the
  original afterward.
- `GuestTryOnUsage`'s device-scoped free-quota pattern → this domain's
  visualization usage limits (V1 needs a cost policy before shipping, same
  reason the AI-usage ledger/wallet system exists for the fashion product).

## AI boundaries (locked, per Constitution §15)

| Layer | Responsibility | Not responsible for |
|---|---|---|
| Computer Vision | Wall/surface/furniture/window/door detection, geometry, lighting, structured facts only. **Partially implemented** (2026-09-07 fast-lane pivot) — `lib/home-material/wall-detection.ts` does single-wall bounding-box detection for a straight-on photo; general multi-wall/geometry/lighting understanding is still future work | Commercial recommendations |
| Material Knowledge | Category-level properties (durability, maintenance, moisture, install/removal), curated/config data | Being generated live per-request |
| Product DB | SKU facts, identity, attributes, source/evidence | Being defined by the image model |
| Recommendation Engine | Deterministic/hybrid scoring over room + requirements + material + product data | Arbitrary LLM-invented scores |
| Visualization Engine | Applying material to a surface; pattern scale/repeat/orientation; preserving everything else | Silently substituting a similar-looking material for the real SKU |
| LLM | NL understanding, explanations, comparisons, summaries over already-computed structured results | Being an uncontrolled source of product specs |

## Data model (V1 draft — see `prisma/schema.prisma`, `hm_`-prefixed models)

`HmUser` → `HmProject` → `HmRoom` → `HmSurface` → (`HmMaterial` and/or
`HmProduct`) → `HmVisualization` → `HmRecommendation` → `HmShortlist` →
`HmRetailer`/`HmRetailerProduct` → `HmLead`. Provenance is first-class via
`HmProductEvidence` (one row per fact per product, with `sourceType` —
manufacturer/retailer/user/platform/ai_inferred/external_verified/
unspecified) — not retrofitted later. `HmSurface` carries an explicit
`measurementSource` (`ai_estimated` | `user_confirmed` | `professional`) so
a convincing estimate is never silently treated as a measurement (§11,
Constitution Principle 6).

Comparison and Shortlist are collapsed into one `HmShortlist` table for V1
(simplification proposed during discovery, not yet contradicted by real
usage data — revisit if/when the two need to diverge).

## Open / deferred (not yet frozen)

- **Room-photo privacy policy** — flagged as a gap during discovery, not in
  the original brief. Needs an explicit principle (default-private, no
  retailer/marketing use without consent) before real room photos are
  collected from real users.
- **Minimum viable catalogue depth** for launch — not yet defined; both
  recommendation quality and product-accurate visualization are bottlenecked
  on real `HmProduct`/`HmRetailer` data existing.
- **Material Knowledge content** (durability/maintenance/moisture text per
  subtype) is likely the true critical path for the "help me choose" mode —
  content work, not code. Not yet started.
- Full `docs/` hierarchy (product/domain/ai/architecture/research/decisions)
  from the original discovery brief — deliberately not built yet; this
  single doc is the placeholder until there's enough content to justify it.

## Known environment issue (pre-existing, not caused by this work — resolved)

Local dev Postgres had migration-history drift from `prisma/schema.prisma`:
one genuinely stuck failed migration plus 12 migrations whose schema effects
were already present in the DB but never recorded (likely applied via
`db push` at some point), all reconciled via `prisma migrate resolve`
without touching any data (2026-09-07). Separately, 4 orphan entries from an
abandoned local branch (`rnd/image-pipeline-benchmarks`) remain harmlessly
in `product_match_dev`'s `_prisma_migrations` table — dead bookkeeping, no
live table, left alone.

## Local database isolation (locked, 2026-09-07)

**This branch (`feature/home-material-intelligence`) uses its own local
database, `product_match_dev_hm`, not the shared `product_match_dev`.**

Why: while generating the `hm_*` migration, `prisma migrate dev` detected
that the shared dev database already had columns from a *different*,
unmerged, actively-developed branch (`feature/ai-catalogue-motion`, motion
job/QA fields for the ad-reel deliverable) that don't exist in `main`'s
`schema.prisma`. Multiple branches apparently share one local dev database,
so whichever branch you're on can find the DB "ahead" of its own schema —
this is the second time in one session a shared-DB-across-branches drift
came up (see above). Since this domain's new tables have zero existing data
to lose, giving it an isolated DB was strictly cheaper than reconciling
with someone else's in-flight work.

**Practical effect:** `.env`'s `DATABASE_URL` currently points at
`product_match_dev_hm` (not tracked by git — this is a local machine
setting). **Switch it back to `product_match_dev` when working on any other
branch**, or you'll be looking at an empty/different database. The new DB
was seeded by replaying the full existing migration history from scratch —
it has no product/retailer/user data of its own yet.
