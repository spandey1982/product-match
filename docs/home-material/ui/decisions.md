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

## Validation-layer flows — shipped 2026-09-10

Third and last piece of the approved phase order (§26 step 4) —
deliberately the plainest work of the four phases, per the discovery
document's own principle that precision/plainness increases as
commitment increases. No illustrated pickers, no progressive disclosure,
no scoring — standard forms.

- **"Request a sample," new alongside "Request a quote"** (brief §41's
  Validation-layer loop: Visualize -> Shortlist -> Request sample ->
  Receive sample -> ... -> Purchase). Previously only a price-quote
  request existed; a sample is a physically different fulfillment (a
  retailer ships a real swatch) tracked as its own `HmLead.leadType`
  ("quote" | "sample", new column) with its own optional
  `shippingAddress` field — a single plain free-text field, deliberately
  not a structured address book, since this domain has no address
  infrastructure yet and inventing one wasn't justified for a demo-
  retailer flow. A sample can only be requested against a real product
  (`productId`) — you can't physically ship "a material category" — so
  the API rejects a sample tied only to `materialCategory`, and the UI
  only offers the sample trigger when a real product is in context.
- **Extracted `LeadCaptureButton` into `components/home-material/
  LeadCaptureButton.tsx`** (previously a private function inside
  `RoomView.tsx`) so it could be reused rather than duplicated.
- **Closed a real gap: the shortlist/compare page had no path to actually
  act on anything.** `/materials/shortlist`'s comparison table already
  showed every fact side by side but had no "now what" — brief §16's
  core journey explicitly has Compare/Shortlist leading into Estimate ->
  Request Quote, and that link was missing entirely. Added a "Next step"
  row with the same quote/sample actions available inline per shortlisted
  product.

Live-tested: shortlisting a product then loading `/materials/shortlist`
correctly returns it; a quote request succeeds with no shipping address
required; a sample request without an address correctly 400s ("A
shipping address is required to send a sample"); the same request with
an address succeeds and stores `leadType: "sample"`; a sample tied only
to a `materialCategory` correctly 400s ("needs a specific product, not
just a material category"). Browser-verified the shortlist page's new
row renders both actions per column, and the sample form correctly shows
a shipping-address textarea in place of the quote form's area-in-sqft
field.

## Visual design system — 2 prototype directions proposed, 2026-09-10

Step 5 of the phase order (the visual design system itself) started once
the user supplied a first draft (a generic "sustainable materials
library" mockup set — sage/cream palette, card grid, tag chips, sidebar
nav, comparison table). Two directions were built on OUR actual screens
(landing/browse, room workspace with wall+swatch+score-breakdown, and a
validation form), not abstract style tiles, so they're a real side-by-
side choice rather than a mood board:

- **[Sage Studio](https://claude.ai/code/artifact/6154b33d-e485-4ee9-89c9-ad360cbf6f7b)**
  (`research/ui-prototype-a-sage-studio.html`) — closely follows the
  supplied draft's calm sage/cream palette and card/chip language, Sora +
  Manrope type, but replaces the draft's persistent sidebar with a simple
  top nav (our product is a guided flow, not a multi-section dashboard —
  a real structural correction, not just a re-skin) and adds the room-
  photo moment the draft doesn't show at all.
- **[Wall & Hearth](https://claude.ai/code/artifact/010e55f5-5877-415f-a411-bf5bf6a594cf)**
  (`research/ui-prototype-b-wall-and-hearth.html`) — a warmer, more
  residential direction: the room photo leads the hero (matching Roomvo/
  IKEA's "open into the tool" pattern), Petrona serif + Karla sans, a
  plaster-grey neutral base (deliberately not the cream+terracotta
  combination that reads as a generic AI-generated default).

Both reuse every component already shipped this session (illustrated
requirement pickers, "why this score" breakdown, cost/estimate chips,
the "You" provenance badge, plain validation forms) — only the token
system (color/type) and a couple of structural choices (sidebar vs. top
nav, text-first vs. photo-first hero) differ, so the comparison is about
visual direction, not different content.

**Status: PROPOSED, awaiting selection** — neither is applied to the
live app yet. Both are local-only files (published as Artifacts for
review; not committed to git — `research/` is gitignored, see the note
in the memory file about this).

## Sage Studio applied to the live app — 2026-09-10

User picked Sage Studio. Applied via a single scoped mechanism rather
than editing every component's className strings:

- New `app/materials/layout.tsx` — loads Sora (headings) + Manrope
  (body) via `next/font/google`, wraps every `/materials/*` route in a
  `.hm-theme` div. Fonts are loaded here, not in the root layout, so the
  fashion side keeps its own Geist/Cormorant/Poppins typography
  untouched — the same domain-separation principle CLAUDE.md already
  applies to schema/business logic, applied here to visual design too.
- New `app/materials/materials-theme.css` — overrides Tailwind v4's
  color theme tokens (`--color-indigo-600`, `--color-gray-500`, etc. —
  confirmed present in `node_modules/tailwindcss/theme.css`) scoped to
  `.hm-theme`. Every home-material component already used plain
  Tailwind utility classes (`bg-indigo-600`, `text-gray-700`, ...)
  referencing these exact tokens, so overriding the underlying CSS
  custom property reskins every one of them — including the SHARED
  `components/ui/Button` — without touching a single component file,
  and with zero effect outside `.hm-theme` (confirmed live: `/login`,
  the fashion side's sign-in page, still renders its original indigo/
  purple branding unchanged).
- **Deliberately did not change border-radius.** Sage Studio's button
  mockup is pill-shaped, but `rounded-xl`/`rounded-lg` are shared by
  buttons AND cards/inputs/panels throughout this domain — overriding
  that token would have pill-shaped every card and input too, not just
  buttons. Status chips are already `rounded-full` and match as-is;
  button shape specifically is a follow-up if wanted, not attempted here.
- Did not build a persistent top nav/logo header — that's a structural
  IA addition beyond "apply the chosen palette/type," left as a
  possible next increment.

Verified: `npx tsc --noEmit`, `eslint`, and a full production build all
clean; browser-verified the retheme across `/materials` (landing/
browse), a room workspace (wall photo, swatch picker, illustrated
budget/priority pickers, truncation warning banner), and `/materials/
shortlist` — all correctly sage-green/Sora/Manrope; separately verified
`/login` (fashion side) is completely unaffected.

## Sage Studio layout restructuring + upload modal — 2026-09-10

**User correction that motivated this pass:** the previous entry above
only reskinned colors/type/component styles on the app's existing
*structure* — the user checked the live `/materials` and room-workspace
pages against the Sage Studio prototype and found the actual layout
unchanged ("same old layout with new theme colours... In fact the Room
Workspace page is nothing like the prototype"). Sage Studio's screens
were meant to be the new structural base, not a palette reference.

**Standing process rule going forward, stated explicitly by the user:**
every future new screen in this domain is generated as progressive
layout/design options (same propose -> pick -> implement workflow used
for the two prototype directions), with Sage Studio's already-approved
screens as the established base to extend consistently — not designed
from scratch each time.

What changed structurally this pass:

- **`/materials` landing/browse page split into a server component +
  client component**: `app/materials/page.tsx` now only fetches
  `BrowseProduct[]` via Prisma and renders `MaterialsLandingClient`
  (new file) inside `<Suspense fallback={null}>` (required because the
  client component reads `useSearchParams()`). `MaterialsLandingClient`
  rebuilds the page to match Sage Studio's actual layout: a split hero
  (headline/CTA left, an SVG room illustration + floating swatch card
  right) above a filter-chip category row and a 4-column product grid
  with hover-reveal "See in my room ->" affordance — replacing the
  previous single-column marketing-strip layout that only borrowed the
  prototype's colors.
- **`/materials/upload` removed as a standalone page**, per the user's
  explicit instruction — a `File` object can't survive a page
  navigation, so it wasn't serving a purpose distinct from a modal.
  Replaced with `components/home-material/UploadRoomModal.tsx` (Radix
  `Dialog`), opened from the hero CTA or from any product card's "See in
  my room," which on confirm POSTs the photo and navigates straight to
  `/materials/rooms/[id]` (with `?product=<id>` preserved when a card
  triggered it) — collapsing upload-page -> redirect into one modal ->
  room-workspace step, matching Sage Studio's single-flow feel. The old
  401 -> login -> return-to-upload-page redirect chain is preserved in
  spirit: an unauthenticated upload now redirects to
  `/materials/login?returnTo=/materials?openUpload=1[&product=...]`, and
  the landing client reads `openUpload`/`product` query params on mount
  to reopen the modal automatically after login (same fundamental
  limitation the old page had — a `File` still can't survive the login
  redirect either way, so the user re-picks the photo post-login).
- **Room workspace (`RoomView.tsx`) per-surface card restructured** from
  a single stacked column into Sage Studio's two-column layout
  (`grid lg:grid-cols-[1.15fr_1fr]`): left column holds the wall
  photo/preview, swatch carousel, and generated-visualization result;
  right column stacks the cost estimator and the "Help me choose a
  material" panel as separate cards. All existing state/logic/props
  (dimension prompts, preview errors, spatial compare, recommendations,
  combinations) preserved exactly — only the JSX container structure
  changed. Verified structurally sound via a clean `tsc --noEmit` (which
  fails on unbalanced JSX) before any visual check.
- **New `ConfirmedWallOutline` component**: closes a real gap versus the
  prototype, which always shows the traced wall outline on the room
  photo. Previously the app showed no wall visual at all until an AI
  generation completed. Now, once a wall is confirmed but before any
  completed visualization exists for it, an SVG polygon (using the same
  fractional `[0,1]` coordinates already stored in `HmSurface
  .geometryData`, scaled via `viewBox="0 0 100 100"` +
  `preserveAspectRatio="none"`) is overlaid on the room photo in Sage
  Studio's forest-green tint.
- **New `app/materials/HmThemeRoot.tsx`** — fixes a real bug found while
  live-testing the new modal: Radix's `Dialog` (used by
  `UploadRoomModal`) portals its content straight to `document.body`, a
  SIBLING of the `.hm-theme` wrapper div `app/materials/layout.tsx`
  already rendered, not a descendant — so the scoped CSS-variable
  overrides never reached the modal, and its "Continue" button rendered
  in the fashion side's default indigo instead of forest-green. Fixed by
  also applying the theme class to `document.documentElement` (a real
  ancestor of body-portaled content) via a client-side effect, alongside
  (not instead of) the existing wrapper div. Generalizes to any future
  portaled component (`Popover`, future dialogs), not just this modal.

Verified live end-to-end after the fix: opened the upload modal (Continue
button correctly forest-green), uploaded a test photo, traced a wall
manually, confirmed it, picked a swatch, generated an AI preview, and
confirmed the full two-column surface card (wall image, swatch carousel,
cost-estimator chip, AI overview-card feedback text, "Request a
quote"/"Request a sample" actions, "Have your own wallpaper or paint
photo?" upload panel) all render correctly in the Sage Studio theme with
no visual regressions. `npx tsc --noEmit`, `eslint`, and a full
production build all passed clean; test room deleted afterward via a
throwaway Prisma script (`HmRoom` cascade-deletes its surfaces/
visualizations).

## Guide & Shortlist layout options — proposed, selected, and shipped, 2026-09-10

Following the standing process rule above (every new screen gets
progressive layout options against the Sage Studio base before
implementation), built a "Guide & Shortlist Layout Options" artifact
(https://claude.ai/code/artifact/4b68b155-eb2c-4f96-8b95-2677acb90591)
proposing two structural directions each for `/materials/guide` and
`/materials/shortlist` — neither screen was in the original 3-screen
Sage Studio prototype, so both needed their own options rather than an
assumed default. Same palette/type/component language throughout; only
layout differs between options.

**User picked 1B for the Material Guide and 2B for Shortlist/Compare.**

- **Material Guide, option 1B (sticky category rail + comparative
  bars)** — `app/materials/guide/page.tsx`: the previous pill-filter row
  is replaced with a slim sticky in-page rail (`lg:sticky lg:top-6`,
  category anchor links), and each material's durability/maintenance/
  moisture — previously plain prose text — is now a relative horizontal
  bar, easier to scan across many materials at once than reading full
  sentences. Bar widths are presentation-only mappings derived from
  `MATERIAL_TAXONOMY` (matched by category+subtype, same pattern
  `app/materials/page.tsx` already uses): durability scales against the
  taxonomy's real max (15 years, lime plaster) as the bar's full-scale
  reference; maintenanceLevel/moistureLevel (ordinal, not numeric) map
  to fixed bar-width bands. Not new domain claims — the underlying
  level/prose text stays the source of truth, the bar is just a visual
  restatement of it.
- **Shortlist/Compare, option 2B (full comparison cards, no table)** —
  `app/materials/shortlist/ShortlistView.tsx`: the attribute-by-row
  table is replaced with each shortlisted product as its own card
  (swatch, name, attribute rows, note, quote/sample actions) — reads
  better on narrower screens and matches the mcard language already used
  on the browse grid. The strongest value per row (durability/
  maintenance/moisture, never cost — cheaper isn't objectively "better")
  is bold-highlighted across the whole shortlist, computed client-side
  from the same taxonomy lookup as the guide page. Required adding
  `subtype` to the shortlist API's material `select`
  (`app/api/home-material/shortlist/route.ts`) since the taxonomy lookup
  needs category+subtype, not just category.

Live-tested both: the guide page's rail+bars render correctly themed
(forest-green bar fills) across all four categories; shortlisted three
real seed products spanning categories (paint/wallpaper/wall_texture)
via direct API calls, confirmed the card grid renders with correct
best-value bold-highlighting (lime plaster's ~15yr durability and "good"
moisture won outright; "low" maintenance tied and both bolded), the
note text and quote/sample actions render correctly, and the
`LeadCaptureButton`'s inline expanding form stays contained within its
own card column with no overflow into neighboring cards. `npx tsc
--noEmit`, `eslint`, and a full production build all passed clean; test
shortlist rows deleted afterward via the same DELETE endpoint the UI
uses.

## Intent-first landing entry — reviewed, prototyped, shipped, 2026-09-11

Following the strategic review in `research/home-material-intent-first-
review.html` (see `product/roadmap.md` for the full outcome), built a
3-option prototype set (`research/prototypes/ui-prototype-intent-entry-
options.html`) for where the new intent input sits inside the
already-locked Sage Studio hero: (A) replacing the primary CTA, (B) a
spotlight bar above an unchanged hero, (C) reading as the headline's own
sentence continuation. **User picked Option C.**

Shipped in `MaterialsLandingClient.tsx`: the input sits directly under
the sub-headline, styled as a natural continuation of "tell us what
you're picturing"; "Upload a photo of your room" / "Browse the material
guide" / "My shortlist" demote to small underlined text links beneath it.
The product grid and category chips are untouched and remain visible
regardless of whether a query is active — submitting a query swaps the
grid's heading and content to ranked matches (or an honest "nothing
close yet, here's the catalogue" fallback), never hides the grid itself.

Matching is Tier-0 deterministic only, per the review's cost-tier
architecture: keyword tokenization + category-keyword bonus + a
"under/below ₹N" price-ceiling hard filter, scored against the exact
same `BrowseProduct[]` array already fetched server-side for the grid —
no new API route, no new database query, no AI/embedding call. Live-
tested: "warm sage paint under 20" correctly returned only paints priced
≤₹20 ranked with Soft Sage/Warm Beige tied at top (category + colour-word
match) ahead of Terracotta (category match only), correctly excluding
Charcoal Grey (₹22, over the ceiling); a nonsense query correctly fell
back to the full grouped catalogue with an honest "nothing close yet"
message rather than a fabricated match. `npx tsc --noEmit`, `eslint`,
and a full production build all passed clean.

Every prototype tour built for this domain from now on is archived
locally at `research/prototypes/` (gitignored, never pushed) — a
permanent progress record even after a decision ships. See
`research/README.md`.
