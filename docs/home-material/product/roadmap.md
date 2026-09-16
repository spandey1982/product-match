# Home Material Intelligence — Roadmap (V1 → V2+)

This is the **single "what's done, what's next, why" reference** for this
domain — the complete arc from A to Z. `product/overview.md` holds the
static thesis/scope; `changelog.md` holds the dated history; this file
holds the forward-looking plan and the reasoning behind it. Read this
after `README.md`, before picking up any new work in this domain.

## Where V1 actually stands (2026-09-10)

The full brief §16 core journey is shipped end to end: Upload → AI wall
detection (polygon, multi-wall, drag-adjust) → Choose (swatch picker OR
help-me-choose recommendations) → Visualize (quick preview /
product-accurate, tagged) → Understand (material guide) → Compare/
Shortlist → Estimate → Request Quote/Sample → Retailer Lead. Multi-wall
sub-problems B/E/G/A/C/F are shipped; D (panoramic) is permanently
deferred. The full UI phase order (Mode A landing/browse → Discovery
vocabulary → Decision vocabulary → Validation flows → Sage Studio visual
system → layout restructuring to match it → Guide/Shortlist layout
options) is shipped. See `changelog.md` for the dated blow-by-blow.

**What V1 is, in one line:** a deterministic, explainable,
taxonomy-driven material advisor with real AI-generated visualization —
no free-text search, no embeddings, no behavioural personalization, no
persistent user profile beyond an OTP-authenticated identity.

## Material & surface expansion register (2026-09-16)

V1 was narrowed from "paint + wallpaper + wall texture + wall panels" to
**wallpaper only** — see `product/overview.md`'s V1 scope note for the
reasoning (ship one category correctly before spreading thin across four).
This is **not** a rejection of the other categories, just a sequencing
call — recorded here so a future session doesn't have to re-derive intent
or re-litigate the decision. Not an active task; revisit only when
explicitly prioritized.

**Deferred wall materials (originally in V1 scope, schema already supports
them, zero migration needed to add):**

| Material | Status | To resume |
|---|---|---|
| Paint | Deferred | `HmMaterial.category = "paint"` taxonomy entries already exist (`lib/home-material/material-taxonomy.ts`). Needs: real seed `HmProduct` rows, visualization prompt/rendering verified for flat colour (no pattern/repeat concerns — should be the simplest of the four to re-add), browse/UI category filter re-enabled. |
| Wall texture | Deferred | Taxonomy entries exist. Needs: seed products, visualization verified for relief/texture rendering (currently untested since only wallpaper is live), UI re-enabled. |
| Wall panels | Deferred | Taxonomy entries exist. `HmProduct.patternType`/`sheetWidthM`/`sheetHeightM` (repeat-sheet math) already generalize to panels (a panel is dimensionally the same problem as a wallpaper sheet — fixed-size rigid units tiled across a wall), so this is likely the *second* easiest to resume after wallpaper. Needs: seed products, panel-specific install/joint visual verification. |

**Treat each the same way wallpaper was built** — same `HmProduct`/
`HmMaterial`/`HmProductEvidence` shape, same AI-boundary rules
(`ai/boundaries.md`), same provenance discipline. No new domain model
required; this was confirmed while designing the wallpaper product schema
(2026-09-16) — the schema is category-agnostic by construction (see that
proposal doc, published as a Claude Artifact and linked from this file's
git history / session notes).

**Beyond walls (further out, not yet scoped in any doc beyond the
`/materials` route-naming decision in `product/overview.md`):** flooring,
tiles, countertops, ceilings, doors, exterior materials. The top-level
`/materials` route (rather than `/walls`) was deliberately chosen in the
original 2026-09-07 brief specifically so this expansion never forces a
URL/SEO-costly rename. No schema or IA work has been done for non-wall
surfaces — don't assume the current `HmSurface.surfaceType` free-string or
`HmRoom` shape is sufficient for e.g. a floor (different geometry entirely
— area not polygon-on-a-photo-plane in the same way, different
measurement UX) without a dedicated discovery pass when that's picked up.

**Trigger to revisit this register:** wallpaper V1 reaching a stable,
validated catalogue + real retailer usage, or an explicit business ask to
broaden category coverage. Until then, treat any paint/texture/panel/
non-wall work as out of scope, same as this file already treats
sub-problem D and the embeddings/taste-graph deferrals below.

### Code/UI gap left by the narrowing — not yet resolved (found 2026-09-16)

The 2026-09-16 scope narrowing was a docs+schema decision; it did **not**
touch the running demo catalogue or the browse UI, so today's app is
still wider than the documented scope:

- `scripts/seed-home-material.ts` seeds 4 paint demo products + 1 texture
  demo product alongside the 1 wallpaper demo product — all 6 still show
  up in `/materials`.
- `components/home-material/MaterialProductCard.tsx`'s exported
  `CATEGORY_ORDER`/`CATEGORY_LABELS` (consumed by
  `MaterialBrowseSection.tsx`'s category tab row) still hardcode all 4
  categories, so the browse page's filter tabs still offer Paint/Wall
  Texture/Wall Panels even though none of them are in scope.

Not a bug — nothing crashes or misbehaves — just an inconsistency between
"documented scope" and "what a visitor actually sees today." Resolve this
before or as part of the wallpaper-catalogue build (the active next task,
see `README.md`'s current-direction section): decide whether to hide the
other 3 tabs outright, mark them "coming soon," or leave them until real
paint/texture data exists, and decide whether to keep the 5 non-wallpaper
seed rows around as demo content or delete them now that the real
wallpaper schema (below) supersedes the seed script's simple shape.

## Wallpaper product schema v1 — shipped 2026-09-16

Full proposal published as a Claude Artifact ("Wallpaper Product Schema")
and archived at `research/home-material-wallpaper-product-schema.html`.
Additive-only Prisma migration
(`20260916124114_hm_wallpaper_product_schema_v1`): `HmProduct` gained
`description`/`materialComposition`/`colorFamily`/`patternCategory`/
`visualStyle`/`installationMethod`/`sampleAvailable`/`familyId`;
`HmProductEvidence` gained `sourceAuthority`; two new tables,
`HmProductFamily` (colourway grouping) and `HmProductEvent`. See
`domain/data-model.md` for the relationships.

**Analytics & badges (approved 2026-09-16, amending the original
proposal's "not adding" call on this):** the original schema draft
proposed deferring trending/bestseller/search-tag fields entirely, on the
grounds that no real behavioural data existed yet. Owner pushed back:
wants this recorded as real architecture now, not just deferred, because
it will power (1) an analytics view of what's actually getting
clicked/viewed/tried/bought, (2) informational badges on product cards,
(3) future marketing/ad decisions about which products to feature —
**explicitly NOT AI-driven, and explicitly NOT allowed to narrow what a
customer sees or force specific products on them** (the same "freedom to
start with a clear mind" principle already locked for the intent-first
entry work below).

**What shipped:** `HmProductEvent` — an append-only interaction ledger
(same convention as `AiUsageEvent`), one row per real event
(impression/hover/click/detail_view/visualize/compare/shortlist/
sample_request/quote_request/purchase), scoped to `hmUserId` when logged
in or an anonymous `sessionId` otherwise (this domain's browse pages are
intentionally unauthenticated — OTP only gates room upload). This is
deliberately the **single source of truth for two separate downstream
uses**, recorded in the model's own doc comment so a future session
doesn't conflate them:
1. **Analytics & badges** (what this was built for) — "bestseller"/
   "trending" computed on demand from real aggregated counts over a time
   window, never stored as a static field on `HmProduct` (would go stale)
   and never an AI opinion.
2. **Session-scoped behavioural personalization** (still proposed, not
   built — see the intent-first section below) — the same raw events
   could feed the signal-hierarchy/convergence-threshold model already
   designed in `research/home-material-intent-first-review.html` §11,
   without building a second tracking system later.

**Governance rule, written down now while uncontested:** this data must
never silently affect search/recommendation ranking or hide non-badge
products — badges are additional, clearly-labelled info only. Any future
sponsored placement stays structurally separate and always labelled —
same rule already locked for sponsored placement generally, extended
explicitly to cover this ledger too.

**Not built yet (real follow-up work, not part of the schema change):**
UI instrumentation to actually emit these events (hover/click/view
handlers across `/materials` and room-workspace screens), the aggregate
query/computation layer for badges, and an admin analytics view. All
deliberately deferred until there's real traffic to observe — the schema
exists now specifically so events start accumulating the moment
instrumentation lands, rather than losing a launch window's worth of data
waiting for a "big" analytics project. No SKU/traffic threshold trigger
needed here (unlike the embeddings/tagging 150-200 SKU trigger below) —
the event log itself costs nothing to have running quietly with low
volume.

## The V2 direction — intent-first entry (proposed 2026-09-11, reviewed and approved 2026-09-11)

On 2026-09-11 a large strategic proposal was brought for review: evolve
the entry experience around natural-language intent, precomputed product
intelligence, behavioural personalization, first-class "room trials," and
a revised OTP gate. **Full critical review:
[`research/home-material-intent-first-review.html`](../../../research/home-material-intent-first-review.html)**
(also published as a Claude Artifact — see the review doc's own header
for the link). Read that document for the complete reasoning; this
section is the operational summary.

### The differentiation thesis behind it (owner's words, recorded in full in the review doc's addendum)

> A time-saving, non-conventional experience that puts this product apart
> from every competitor — features can be copied by anyone, but
> experience originality can't be. The consumer should feel attended to
> like a customer-care agent in a physical store: they say what they're
> looking for, and the application does most of the remaining work,
> rather than requiring them to learn the product first. This is an
> explicitly accepted risk — there is no historical precedent or
> platform-scale data to de-risk it in advance.

This thesis is the reason the intent-first work is prioritized ahead of
some technically-adjacent items that would otherwise queue first. It does
**not** relax the cost/complexity discipline below — the owner explicitly
endorsed keeping that discipline exactly as reviewed.

### Review outcome — classified

Full reasoning for every row is in the review document. Condensed:

**Locked now** (cheap, reversible, ship without further discussion):
- ~~Server-side visualization cache/dedupe~~ — **shipped 2026-09-12**, see below.
- ~~"Room Trial" as the user-facing name~~ — **shipped 2026-09-12**, see below.
- OTP screen copy: "Create/save your room trial," never "enter your phone
  number." — **not yet done**, small follow-up left from the rename above.
- Sponsored-placement governance (never enters the ranking math, always
  labelled) — write this rule down now even before sponsorship is on the
  roadmap.
- "Based on what you've explored" reversible framing + one-click reset,
  wherever behavioural personalization eventually surfaces.

**Shipped 2026-09-12:**
- Mobile wall-vertex precision loupe (`RoomView.tsx`'s `DragLoupe`) — a
  2.5x magnified, finger-offset view of the room photo with a crosshair,
  shown only for touch/pen drags of a wall-outline vertex, never for
  mouse. Also fixed an unrelated mobile-only bug found alongside it: the
  confirmed-wall preview card's room photo could blow out past the card
  and the viewport on narrow screens (a `grid-template-columns: none`
  gap below the `lg` breakpoint let the image's intrinsic size set the
  track width) — fixed with an explicit `grid-cols-1` base. A second
  instance of the same root cause was later found on the `≥lg` desktop
  track itself (`lg:grid-cols-[1.15fr_1fr]` has no `minmax(0,...)` floor)
  — adding wallpapers/swatches grew the whole preview card horizontally
  instead of scrolling inside the swatch carousel; fixed the same way.
- **Server-side visualization cache/dedupe** — the single biggest locked
  cost win from the review, now actually built. `lib/home-material/
  visualization.ts`'s `computeVisualizationCacheKey` hashes every input
  that determines the generated pixels (room photo, wall outline/corners,
  product identity + its colour/finish/pattern/texture/sheet fields,
  resolved wall dimensions, adjacency offset); `HmVisualization` gained
  `cacheKey`/`version`/`savedAt`/`expiresAt` columns. `POST /api/
  home-material/visualizations` looks up a matching `status:"completed"`
  row for the same surface before calling Gemini at all — a hit returns
  the prior row verbatim (`{cached:true}`), skipping both the image-edit
  call(s) and the overview-QA call entirely. Verified via a zero-cost
  method (seeding a fake completed row with a hand-computed matching
  key, since the account's Gemini prepaid credits were depleted at the
  time — see the open-question note below): the API returned the seeded
  row's id/content and no new `AiUsageEvent` rows were created.
- **"Room Trial" rename** — the user-facing noun for a generated
  visualization is now "room trial" throughout `RoomView.tsx` (button:
  "Generate room trial"; mode badges: "Quick room trial — AI
  interpretation" / "Product-accurate room trial — from your uploaded
  photo"; error/empty-state copy updated to match). Deliberately scoped
  to user-facing strings only — `HmVisualization`, `handleGeneratePreview`,
  the `/api/home-material/visualizations` route path, and other internal
  identifiers are unchanged; renaming those would be a large, purely
  cosmetic refactor with no user-facing benefit. OTP screen copy
  ("create/save your room trial") is a separate small follow-up, not
  done in this pass.
- **Fullscreen zoomable room trial viewer** (`components/home-material/
  ImageLightbox.tsx`, new) — clicking a generated room trial image (the
  main result, or either thumbnail in Spatial Compare) opens it
  fullscreen on a dark backdrop; wheel or pinch to zoom (up to 4x), drag
  to pan once zoomed, double-click/double-tap to toggle a 2.5x zoom,
  Escape/close-button/backdrop-click (only while at 1x) to close. Built
  on the same Dialog primitive as `UploadRoomModal` rather than a new
  dependency — plain pointer-event arithmetic, not library-sized.
  Verified via a throwaway isolated test route (deleted after) since no
  session-loaded visualization history exists to click on without a live
  generation, which the depleted Gemini credits blocked at the time.

**Shipped 2026-09-11:**
- Intent text input on `/materials`, styled as "Option C" from
  `research/prototypes/ui-prototype-intent-entry-options.html` (the
  headline's own sentence continuation, not a separate search form) —
  chosen from a 3-option prototype set specifically for balancing
  "intriguing, not overpowering" against keeping the product grid
  visible. Upload/browse/shortlist demoted to secondary text links.
  Tier-0 deterministic matching only (`MaterialsLandingClient.tsx`'s
  `scoreProduct`/`parsePriceMax`/`tokenize`): category+colour+price-
  ceiling keyword extraction scored against the same product array
  already fetched for the grid — zero new API calls, zero AI cost. Falls
  back honestly to the full catalogue when nothing scores above zero,
  rather than claiming a confident match. Tier 1 (embeddings) remains
  deferred per the trigger below.

**Proposed — needs scoping:**
- Extending `lib/home-material/wall-detection.ts`'s existing single
  Gemini call's response schema to also return room-context fields
  (existing wall colour, dominant room colours, visual style,
  windows/doors/obstructions) — **not** a second analysis pipeline.
- Extending the existing deterministic `WEIGHTS` scorer in
  `lib/home-material/recommendation.ts` with intent-match/behavioural/
  visual-similarity terms, keeping the linear weighted-sum shape so the
  shipped `ScoreBreakdown` UI keeps working unchanged.
- A session-scoped (not persistent) preference signal, computed as plain
  arithmetic over fields `MATERIAL_TAXONOMY` already has — no new ML.
- Mobile precision loupe for wall-vertex dragging (drag-activated only,
  native-loupe-convention placement) — a real, validated interaction gap,
  independent of the rest of this roadmap item.
- A Product Intelligence Record **schema** (fields only — fact vs.
  calculated vs. derived vs. inferred vs. semantic, per the review's
  §Product Intelligence) — cheap to formalize now, no embedding
  infrastructure yet.

**Reopens a shipped, working decision — needs its own explicit sign-off,
separate from the rest of this roadmap:**
- Moving the OTP gate from "before room upload" (today's actual shipped
  behaviour, confirmed via `app/api/home-material/rooms/route.ts`) to
  "immediately before generation." Recommended, but changes the
  abuse-surface assumptions the current code was built against — see the
  review doc's dedicated callout before touching `UploadRoomModal`'s
  401-handling or `LoginView`'s `returnTo` logic.

**Deferred — correct idea, wrong time, with a stated trigger to revisit:**
- Precomputed embeddings / vector index infrastructure. Trigger: catalogue
  crosses roughly 150–200 SKUs across multiple retailers. Below that, a
  plain attribute filter outperforms it.
- Persistent, cross-session, account-level taste graph. Trigger: real
  data showing users return across multiple sessions often enough to
  justify the privacy/complexity cost — doesn't exist yet.
- Trial download/reupload recognition (fingerprinting/watermarking/
  registry). Trigger: real users demonstrably losing access to
  account-saved trials and specifically asking to recover via a
  downloaded image. Until then, "log back in, your trials are saved" —
  the much cheaper near-term version — covers the actual need.

**Rejected as proposed:**
- An intent-only landing hero that hides the product grid until the user
  types (cold-start / blank-box problem).
- A visual-trial-first generative hero (highest "AI wallpaper generator"
  positioning risk of any option considered).
- A black-box/ML ranking model replacing the deterministic scorer.
- A hard-coded 15-day trial retention constant (use a configurable
  default instead, revisit with real Cloudinary storage-cost data).
- Time-on-site as a primary success metric.

### Next concrete step

With the intent-first entry shipped, the next items in sequence are the
other "build now" proposals from the review that haven't shipped yet:
server-side visualization caching, the "Room Trial" rename, the mobile
precision loupe, and the room-analysis schema extension — see the
Implementation Sequence section of
`research/home-material-intent-first-review.html`.

### Prototype archive

Every UI layout prototype tour built for this domain (and going forward,
any domain) is kept locally at **`research/prototypes/`** — gitignored,
never pushed to origin, a permanent progress record even after a choice
ships. See `research/README.md` for the index and convention.

## Open questions carried forward

- What real trigger (exact SKU/retailer count) should gate building
  embedding infrastructure — a number to hold the team to later, not a
  vibe.
- Default trial retention window — pick once real Cloudinary storage cost
  for this catalogue's image sizes has actually been checked.
- Whether sponsored placement is even on the near-term roadmap — if not,
  the governance rule above can stay dormant, but is written down now
  while it's uncontested.
