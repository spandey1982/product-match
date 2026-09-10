# Home Material Intelligence — UI Discovery & Decisions

Part of the domain-scoped docs split approved 2026-09-10 — see
`../README.md` for the index.

## The discovery document

Full research, evidence matrix, reference register, conflict analysis,
and proposed information/experience/interaction architecture live in
[`research/home-material-ui-discovery.html`](../../../research/home-material-ui-discovery.html)
(repo-root `research/`, matching the house style of this repo's other
research papers — see that folder's existing convention). Read that
document first before picking up UI work in a future session; this file
only records the decisions made against it.

## Decisions locked 2026-09-10

The discovery document's §27 posed 5 questions for review. Outcomes:

1. **Mode A entry point (standalone browse, no room upload required):
   APPROVED, build now.** Shipped same day — see "What shipped" below.
2. **Interactive homepage hypothesis: APPROVED, with a specific shape.**
   Not a separate marketing hero page plus a separate browse page — ONE
   merged screen. `/materials` itself is now the landing page AND the
   Mode A catalogue browse, communicating the product's core differentiator
   (see it on your own wall before buying) directly alongside real
   products, rather than routing a marketing hero to a second page.
3. **Docs restructuring (this split): APPROVED.** `docs/home-material/`
   is now organized into `product/`, `domain/`, `ai/`, `architecture/`,
   `ui/`, with the chronological shipped-feature history moved to
   `changelog.md`. Zero code impact.
4. **Rituals / Amazon Watch-and-Shop downgrade: APPROVED, with a stated
   balance.** Both stay downgraded from "adopt" to "investigate cautiously"
   per the discovery document's evidence review — but explicitly NOT
   reclassified as disproven or permanently rejected: absence of strong
   supporting evidence for a pattern is not evidence the pattern would
   fail for this product. Revisit either if a stronger source surfaces.
5. **Proposed phase order (Mode A gap → Discovery vocabulary → Decision
   vocabulary → Validation flows → visual system): APPROVED as-is.**

## What shipped against decisions 1 and 2 (2026-09-10)

- `app/materials/page.tsx` rebuilt as the merged landing + Mode A browse
  page: hero section (value proposition, "Upload your room" primary CTA)
  directly above a public, unauthenticated, server-rendered product grid
  grouped by material category (paint/wallpaper/wall_texture/wall_panel),
  each card showing a real color/pattern swatch and honest pricing (exact
  retailer price vs. indicative range — same never-blend rule used
  elsewhere in this domain). Marked `export const dynamic = "force-dynamic"`
  since pricing must never serve a stale build-time snapshot.
- **"See in my room" deep link**: picking a product on the browse page
  carries its id through the entire unauthenticated → login → room-upload
  → room-creation chain (`?product=<id>` query param, preserved through
  the existing `returnTo` login redirect) and pre-selects that product in
  the swatch picker the moment the user confirms their first wall —
  closing the loop the discovery document flagged (Mode A previously had
  no home in the app; a user who already knew what they wanted had to
  re-find it after uploading).
- Browser-verified end to end (not just script-level): clicked "See in my
  room" on a real seeded product from `/materials`, uploaded a test photo,
  detected + confirmed a wall, and confirmed the product was pre-selected
  in the swatch carousel on the resulting surface.

## Discovery-layer vocabulary — shipped 2026-09-10

First piece of the approved phase order's step 2 (§26 of the discovery
document): concrete anchors, richer material cards, and spatial compare,
all built on top of the existing engine — no new AI surface, no schema
change.

- **Concrete/illustrated requirement anchors** (`RoomView.tsx`'s
  `IllustratedPicker`, `BUDGET_OPTIONS`/`PRIORITY_OPTIONS`): the "Help me
  choose" panel's budget and priority pickers were plain `<select>`
  dropdowns with bare abstract labels ("Durability matters most"). NN/g's
  customization-features research (discovery doc §4) found abstract
  attributes need a concrete real-world scenario to perform well — its
  Joybird example illustrated "comfort" with seat-height/posture
  pictures rather than a bare slider. Replaced both dropdowns with
  illustrated card-choice UI (one concrete sentence per option, e.g.
  "Best for high-traffic walls — hallways, kids' rooms, rental
  properties"). Presentation only — `lib/home-material/recommendation.ts`'s
  four-value scorer and weights are unchanged.
- **Suitability chips on material cards** (`app/materials/page.tsx`):
  browse-page cards now show durability (~Nyr) and maintenance level
  alongside color/price. Sourced from `MATERIAL_TAXONOMY` (matched by
  category+subtype), not a new `HmMaterial` DB column — the DB model only
  stores prose durability/maintenance text; the structured
  `durabilityYearsApprox`/`maintenanceLevel` fields the recommendation
  engine already treats as authoritative live only in the typed taxonomy
  source, reused here rather than duplicated into the schema.
- **Spatial compare** (`RoomView.tsx`'s `SpatialCompare`): every completed
  generation for a wall this session is now kept (`visualizationHistory`,
  additive alongside the existing single-`visualizations` "latest
  preview" state, session-only — not persisted, no schema change). Once
  2+ generations exist for a wall, a "Compare what you've tried on this
  wall" section shows two of them side by side, each swappable via a
  dropdown, defaulting to the two most recent. Costs nothing beyond what
  trying each material already cost — no new generation is triggered by
  comparing.

**Bug found and fixed while live-testing spatial compare:** the compare
dropdowns both displayed the same (wrong) label even though the two
images shown below them were correctly different. Root cause: React
mounts a component's hooks on first render regardless of an early
`return null`, so `SpatialCompare` was mounting (and its `useState`
defaults locking in) the very first time a wall card rendered — while
history was still empty — rather than when 2 real generations existed.
Fixed by moving the "2+ completed generations" check to the call site so
`SpatialCompare` only mounts once real data exists to default from.
Confirmed the underlying bug (images correct, labels wrong) via a live
two-generation test on the same wall (Charcoal Grey, then Soft Sage);
the fix itself was verified via type-check and code review rather than a
third live generation, to avoid unnecessary further AI cost for a
narrowly-understood React lifecycle fix.

## Decision-layer vocabulary — shipped 2026-09-10

Second piece of the approved phase order (§26 step 3): recommendation
explainer, cost/estimate strip, and a provenance indicator — all reusing
data the backend already computes, no new AI surface.

- **"Why this score?" breakdown** (`RoomView.tsx`'s `ScoreBreakdown`,
  `lib/home-material/recommendation.ts`'s new exported `WEIGHTS` +
  `MaterialRecommendationResult.components`): brief §37 calls for
  explaining a recommendation rather than showing a bare percentage.
  Each recommendation card now has a collapsed-by-default (progressive
  disclosure) breakdown of the four weighted scoring dimensions
  (moisture/budget/priority/category), each as a small bar + its real
  weight. **Deliberately not persisted or restorable after a GET/page
  reload** — the requirements a score was computed from were never
  persisted either, so a breakdown can't be honestly reconstructed after
  the fact; only present on a fresh POST response. Verified live: wet-
  area + budget + durability requirements produced `{moisture:1,
  budget:1, priority:0.8, category:0.8}` for the top pick, and a
  follow-up GET (simulating a page reload) correctly omitted the field.
- **Cost/estimate strip tightened** (`CostEstimator`): the existing
  exact-vs-range distinction was inline parenthetical text; now a
  persistent visual chip ("Retailer price" vs "Platform estimate") sits
  before the number, so the estimate-vs-real-price distinction survives
  a skim rather than requiring the user to read the whole line.
- **Provenance signal on the swatch picker** (`SwatchCarousel`): a small
  "You" badge now marks your own custom-uploaded materials in the
  carousel, distinct from curated catalogue items — previously this
  distinction only surfaced AFTER generating a preview (the "Product-
  accurate — from your uploaded photo" mode badge), not while choosing.
  Scoped narrowly: `HmProductEvidence` (sourceType platform/retailer/
  user) is written on every product today but still has no broader
  reader anywhere in the app — a fuller provenance UI (e.g. distinguishing
  a real retailer-verified identity once retailer partnerships exist)
  is deferred, not attempted this pass, since every non-custom product
  today is platform-curated demo content and a repeated "platform
  example" badge on every single card would be noise, not signal.
