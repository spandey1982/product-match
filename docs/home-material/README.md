# Home Material Intelligence Platform — Domain Brief

Status: **Full V1 core journey shipped (2026-09-08)** — see the dated
"shipped" sections below for what exists. This is the anchor doc for this
domain; read it before re-deriving architecture context in a future
session (see CLAUDE.md §6). It intentionally stays lightweight — not the
full docs/ hierarchy sketched in the original discovery brief — until
there's enough real code to justify splitting it.

**Current direction, locked 2026-09-08 (read this before picking up
work):**
- Real-photo visualization quality is user-confirmed working (manually
  verified against an actual room wall) — the "only tested on synthetic
  images" gap from earlier is closed.
- **Multi-wall detection/selection is explicitly NOT being built yet.**
  User wants a proper discussion first to align on approach before any
  code — do not start implementing this without that discussion, even if
  it looks like the obvious next increment.
- **UI visual polish is paused pending reference designs the user will
  upload.** Don't restyle existing screens speculatively — wait for the
  references, then build against them.
- In the meantime: close out small, non-business-blocked, non-UI,
  non-multi-wall gaps (field-level product provenance, the cosmetic
  mask-halo artifact) — see "Flagged" lists throughout this doc.

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

### Pivot update — polygon outline + editable vertices + custom upload (2026-09-07, same day)

User feedback after the first real-photo-adjacent test: selection was "very
rigid and rectangular," needed to follow the wall's actual outline, be
user-adjustable, and support the user's own material photos, not just the
curated demo list. All three built and live-tested successfully the same
day.

**✅ V1/plan items now addressed:**
- `HmSurface.geometryData` is now an arbitrary polygon
  (`{points: [{x,y}, ...]}`, 3–12 vertices), not a rectangle — closer to
  brief §9's "preserve the room" and §33's `Surface.geometry` concept than
  the earlier bounding-box shortcut was.
- The draft-then-confirm UX (AI polygon or manual clicks → drag vertices to
  adjust → confirm) is a real, if narrow, instance of brief §11's
  "AI estimation + user confirmation" measurement policy — not just schema
  support for it, an actual working interaction now.
- Custom material upload uses **reference-image conditioning** (the
  uploaded photo is sent to Gemini directly, not described in text) — this
  is architecturally a meaningful step toward brief §9's **Product-Accurate
  Preview** (Principle 1, "reality over imagination": the real uploaded
  material, not an AI-imagined approximation). Not a full claim of
  product-accurate mode (still tagged `mode: "quick_preview"` in the DB,
  no SKU/retailer/provenance behind it) — see flagged items.

**🆕 New addition, worth keeping long-term (update to the plan):**
"Upload your own wallpaper/paint photo" as a first-class input path,
alongside picking from a catalogue — genuinely useful for brief §8 Mode A
("I found this wallpaper — show me how it looks") when the user has a
photo of it but it isn't in any retailer catalogue yet. Fits the existing
provenance model cleanly (`HmProductEvidence.sourceType` already has
`"user"` as an option) even though field-level evidence rows aren't wired
up for it yet (see flagged).

**⚠️ Flagged — shortcuts/gaps to revisit:**
- A small visual artifact: when the AI polygon routes around a small
  cutout (e.g. a window) using a thin "bridge" back-and-forth segment
  (the standard single-path polygon-with-hole technique), the mask's
  feather blur can leave a faint soft halo right at that cutout's edge —
  cosmetic, not a correctness bug (confirmed: the cutout itself stayed
  untouched in testing), but worth tightening later (candidate fix: render
  true multi-subpath SVG holes instead of trusting the model's single
  self-intersecting point list as-is).
- ~~No re-editing of an already-confirmed wall yet~~ — **resolved**, see
  the "back nav, reupload, re-shape" commit: `PATCH .../surfaces/[id]`
  plus an "Edit shape" control in RoomView.
- ~~Custom uploads don't get HmProductEvidence rows~~ — **resolved
  2026-09-08**, see "Field-level provenance — shipped" below.
- AI polygon vertex count is capped at 12 — a wall with several
  windows/doors/obstructions may exceed what's traceable in that budget;
  the model is instructed to fall back to a simpler outer boundary + a
  text note rather than force it, but that fallback hasn't been tested
  against a genuinely complex wall yet.

## Material Knowledge — shipped (2026-09-08)

The first item resumed from the original V1 pathway (was "paused" during
the fast-lane pivot; see that section above). Answers brief §12's "what
type of material should I consider?" independently of any SKU.

- `lib/home-material/material-taxonomy.ts`: 16 curated subtype entries (4
  each across paint/wallpaper/wall_texture/wall_panel) — durability,
  maintenance, moisture suitability, installation/removal notes,
  advantages/limitations, and an indicative INR/sqft cost range. Typed
  single source of truth, not buried in a seed script.
- **Honesty split, deliberately recorded, not glossed over:** the
  durability/maintenance/installation/moisture text is general,
  well-established domain knowledge (e.g. "vinyl wallpaper is washable and
  moisture-resistant") — low risk of being materially wrong. The **cost
  ranges are the genuinely uncertain part** — Claude-estimated, not
  verified against any live supplier/market data, and both the app (see
  the guide page's own copy) and this doc say so explicitly. Needs real
  market verification before being treated as authoritative (Constitution
  Principle 4 — never manufacture certainty).
- `scripts/seed-material-knowledge.ts` (`npm run db:seed:hm-materials`,
  also chained into `db:seed:hm`) seeds it into `HmMaterial`. The demo
  product seed now links each swatch to a real subtype instead of the old
  generic per-category placeholder rows (which are deleted on re-seed).
- `GET /api/home-material/materials` — deliberately the **one public,
  unauthenticated** Home Material endpoint. This is general reference
  content, not user- or room-specific, and per brief §8 Mode B
  understanding material types logically precedes needing an account at
  all.
- `/materials/guide` — a public browse page, category-sectioned, linked
  from the `/materials` home page.

**Still not built (as of the Material Knowledge commit):** the
deterministic Recommendation Engine — see the next section, shipped the
same day.

## Recommendation Engine — shipped (2026-09-08)

"Help me choose" mode (brief §8 Mode B) is now real. Deterministic,
per the AI-boundaries rule — never an LLM-invented score.

- `lib/home-material/recommendation.ts`: scores every Material Knowledge
  entry against stated requirements (wet-area, budget tier, a single
  priority — durability / low-maintenance / premium-look / none —, and an
  optional preferred category), weighted sum (moisture 0.35, budget 0.25,
  priority 0.30, category 0.10), plus a rule-based explainer producing
  ✓ reasons / ⚠ concerns per brief §40's example format. Architecturally
  mirrors `lib/matching-engine/scorer.ts` + `explainer.ts`'s separation of
  concerns — no code shared, entirely different weights/rules, since that
  engine is protected fashion IP.
- `POST/GET .../surfaces/[surfaceId]/recommend`: computes and persists
  (replacing any prior set for that surface) top-6 `HmRecommendation` rows,
  material-only (`productId: null`) — this recommends a material
  *category*, not a specific SKU, matching brief §8's "Material
  Recommendation" step preceding "Product Recommendation."
- RoomView: a "Not sure? Help me choose a material" section per wall,
  alongside (not replacing) the existing swatch-picker "I know what I
  want" path — both Mode A and Mode B now coexist on the same surface. A
  recommended material with a matching demo swatch gets a one-click
  "Preview this" shortcut into the existing visualization flow; one
  without a swatch yet links to the material guide instead of a dead end.

Live-tested three requirement combinations directly against the API
(wet-area+budget+low-maintenance; premium-look+wallpaper preference;
no preferences at all) — rankings and reasons/concerns came back
correctly differentiated and sensible in every case, and GET correctly
returned the persisted set after the last POST.

**At the time of this commit:** Product-Accurate mode and retailer/lead
capture were still open — both shipped later the same day, see below.

## Product-Accurate mode — partially shipped (2026-09-08)

Reframed to something buildable honestly without fabricating retailer
data (see "Deferred pending your input" below): `HmVisualization.mode` is
now actually set correctly instead of always hardcoded to
`"quick_preview"`. When a product carries a real uploaded reference photo
(`textureAssetUrl` — currently only custom uploads have one), the
generation is genuinely using the real material, not an AI-imagined
approximation of a text description — that's `"product_accurate"` per
Constitution Principle 1 ("reality over imagination"), regardless of
whether a retailer is attached yet. A curated demo swatch (text fields
only, no photo) stays `"quick_preview"`.

- `lib/home-material/visualization.ts`'s `QuickPreviewResult.mode` is
  computed from whether a reference image was actually used.
- The visualizations API sets this at creation (from whether the product
  has a `textureAssetUrl`) and confirms it from the actual result.
- RoomView now visibly labels every completed preview "Product-accurate —
  from your uploaded photo" or "Quick preview — AI interpretation" — this
  was a real transparency gap before (Principle 1's "do not silently
  substitute" was true in the pixels but never disclosed in the UI).

Live-tested both paths directly against the API: a curated swatch
correctly tagged `quick_preview`, an existing custom upload correctly
tagged `product_accurate`.

**Resolved, same day — retailer/lead capture shipped.** Flagged the
fake-retailer-data question to the user rather than deciding unilaterally;
they confirmed: seed one clearly-labeled, swappable placeholder for
building/testing purposes, replace with real retailer data whenever real
partnerships exist.

- `scripts/seed-retailers.ts` (`npm run db:seed:hm-retailers`, chained
  into `db:seed:hm`): exactly ONE `HmRetailer` row —
  `"[Demo] Sample Retailer — not a real business"`, contact email on the
  `.invalid` TLD (RFC 2606 — reserved specifically for addresses
  guaranteed never to resolve, not a plausible-looking fake domain),
  `isVerified: false`. Linked to the 6 existing demo products via
  `HmRetailerProduct` with illustrative per-sqft prices (same "indicative,
  not verified" honesty as the material taxonomy's cost ranges). Nothing
  else in the codebase assumes this specific row — only that *some*
  `HmRetailer` exists.
- `POST /api/home-material/leads`: creates an `HmLead`, resolving to
  whichever retailer exists and the user's project automatically. Accepts
  either a `productId` (from a completed preview) or a `materialCategory`
  (from a recommendation, which is material-level, not SKU-level) —
  matches brief §17's "consumer-first experience + retailer
  catalogue/lead backend, no marketplace in V1." Response always echoes
  the real retailer name/`isVerified` back — never lets the UI assume or
  hardcode who "received" the request.
- RoomView: a "Request a quote" control next to a completed preview
  (product-tied) and next to each recommendation card (category-tied).
  The open form shows "⚠ Demo mode — no real retailer will receive this
  yet" before submission, and the confirmation explicitly names the demo
  retailer and restates that it isn't real — never a silent success
  message that could be mistaken for reaching an actual business.

Live-tested directly against the API: validation (missing name/phone →
400), a real product-tied lead (correct retailer + auto-resolved project),
a material-category-tied lead with no product, and unauthenticated access
(→ 401). Test leads cleaned up after.

**Still open:** a full "real retailer SKU + provenance" product-accurate
tier still waits on actual retailer partnerships — the mechanism is
proven, the data behind it is still a placeholder.

## Cost Estimate — shipped (2026-09-08)

The brief's "Estimate" step (§16 core journey, §35 cost model), the last
gap between "Visualize" and "Request Quote." Material cost only — never
blurs into installation/labour, and never presents a range with false
precision when a real number exists.

- `GET /api/home-material/products` now resolves each product's cost:
  a real retailer-listed per-sqft price when one exists (exact — the demo
  retailer's 6 listings), else the material category's general indicative
  range (platform estimate) — deliberately never both at once.
- `.../recommend` now also returns the material's cost range (recommendations are category-level, so only the range applies, never an exact price).
- `CostEstimator`: a small reusable widget — area (sqft) in, total cost out
  — shown next to the swatch picker (for the selected product) and inside
  every recommendation card (for that material). Explicit "(material only,
  retailer-listed price)" vs "(material only, platform estimate)" labels,
  never blended.
- The lead form gained its own "approximate area (sqft)" field, converted
  server-side to `HmLead.estimatedAreaSqm` (which is genuinely square
  metres — the conversion happens in exactly one place so the stored field
  matches its own name honestly, while the UI stays in sqft, the unit
  every cost figure in this domain already uses).
- Fixed a real bug spotted while wiring this up: the lead confirmation
  message referenced `result.retailerName` but the API returns `.name` —
  would have silently rendered "undefined" in the confirmation text.

Live-tested: a demo product's resolved price comes back exact (₹18/sqft,
`priceIsExact: true`), a custom upload correctly has no price data at all
(no fabricated numbers), a recommendation's material cost range comes
through, and a lead submitted with `areaSqft: 100` stored
`estimatedAreaSqm: 9.2903` — the exact expected conversion.

## Shortlist + Compare — shipped (2026-09-08)

The brief's "Compare"/"Shortlist" steps (§16 core journey, between
Understand and Estimate). `HmShortlistItem` existed in the schema from
Phase 1 with zero implementation until now — product-level (a specific
swatch/SKU), not material-level, since you shortlist actual candidates,
not whole categories.

- `POST/GET /api/home-material/shortlist`, `DELETE .../shortlist/[productId]`:
  add/list/remove, upsert-on-duplicate (re-adding just updates the note).
  GET joins each product's material (durability/maintenance/moisture text)
  and resolves cost the same exact-vs-range way as the products/recommend
  endpoints — same honesty rule, never both at once.
- A heart-toggle button on every swatch card in the carousel (not just on
  a generated preview) — you can shortlist while browsing, before ever
  clicking Preview.
- `/materials/shortlist`: a comparison table, attributes as rows,
  shortlisted products as columns (swatch/colour, material type, cost,
  durability, maintenance, moisture suitability, your note), horizontally
  scrollable for many items. Linked from the room page header (with a
  live count) and the `/materials` home page.

Live-tested 7 cases directly against the API: empty initial state, adding
two products with notes, re-adding a duplicate (upsert, not an error),
listing with full joined comparison data, removing one, confirming the
right one remains, and unauthenticated access (→ 401). Test data cleaned
up via the test's own delete calls, verified empty afterward.

## Field-level provenance — shipped (2026-09-08)

`HmProductEvidence` existed in the schema since Phase 1 with nothing ever
writing to it — Constitution Principle 3 ("separate facts from
inference") and brief §14 Data Provenance, finally real. Closed as one of
the small, non-business-blocked, non-UI gaps while multi-wall detection
waits for a dedicated discussion and UI polish waits for reference
designs (both explicitly deferred by the user, 2026-09-08).

- `lib/home-material/provenance.ts`'s `recordProductEvidence` — "set
  latest evidence for this field" semantics (no unique constraint exists
  on productId+field in the schema, so this deletes any prior row for the
  same field before inserting, keeping re-seeds idempotent rather than
  piling up duplicates).
- Wired into all three places a product fact actually originates:
  demo-product seed → `sourceType: "platform"` (curated by Claude, not a
  real manufacturer spec — said honestly, not implied otherwise), the
  retailer seed's price → `sourceType: "retailer"` (genuinely retailer-
  sourced, since that row IS the retailer's listing), custom upload →
  `sourceType: "user"` (they uploaded the actual photo) — this last one
  runs live on every future upload, not just backfilled demo data.

Live-tested: re-running the full seed chain twice produced the same 19
evidence rows both times (idempotent, no duplicates), and a real API
upload created a `sourceType: "user"` row that cascade-deleted correctly
when the test product was removed.

## Mask-halo feather tuning (2026-09-08)

The cosmetic artifact flagged earlier (a faint halo where the AI
polygon's "bridge" technique routes around a small cutout) — reduced the
feather blur radius (1%/8px-min → 0.6%/5px-min) to shrink the affected
area. This is a proportionate tuning fix for a confirmed-cosmetic issue,
not the full geometry-aware rewrite (detecting the bridge and rendering a
true multi-subpath SVG hole) — that's still the real fix if this
resurfaces as an actual complaint rather than a known minor artifact.

## Current priorities, locked 2026-09-08

1. **Multi-wall detection/selection** — explicitly paused pending a
   dedicated discussion with the user before any implementation, even
   though it's the most obvious remaining CV gap. Do not start this
   without that discussion.
2. **UI visual polish** — paused pending reference designs the user will
   upload. The app is functionally complete end-to-end but not yet
   "presentable"; don't restyle speculatively before the references
   arrive.
3. Real-photo visualization quality is user-confirmed working (manually
   verified against an actual room wall) — no longer an open gap.

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
- ~~Material Knowledge content... not yet started~~ — **shipped**, see the
  "Material Knowledge — shipped" section above. (Stale note, left visible
  rather than silently deleted — see CLAUDE.md §21 on curated knowledge.)
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
