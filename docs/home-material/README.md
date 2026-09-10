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

1. ~~**Multi-wall detection/selection** — explicitly paused pending a
   dedicated discussion with the user before any implementation~~ —
   discussion happened 2026-09-09 (see below), broken into sub-problems
   A–G; user chose to start with **G + lightweight E**, both shipped
   2026-09-09. **B/C/D/F remain paused** pending further explicit go-ahead
   — see "Multi-wall discussion" below.
2. **UI visual polish** — paused pending reference designs the user will
   upload. The app is functionally complete end-to-end but not yet
   "presentable"; don't restyle speculatively before the references
   arrive.
3. Real-photo visualization quality is user-confirmed working (manually
   verified against an actual room wall) — no longer an open gap.

## Multi-wall discussion (2026-09-09) — sub-problem taxonomy

The user's detailed multi-wall requirements were broken into 7 labeled
sub-problems for phased delivery:

- **A** — multi-wall/shared-corner recognition
- **B** — perspective/angle-correct projection (homography) — genuinely
  hard new CV work; prototyped in isolation, then **wired in 2026-09-09**
  (see below)
- **C** — cross-wall pattern continuity across a shared corner — depends
  on B, **still paused**
- **D** — wide-angle/panoramic multi-wall (3+ walls, lens curvature) —
  recommended permanent deferral; the guided straight-on capture avoids
  this scenario entirely
- **E** — multiple materials in one photo (different walls/zones) —
  mostly already architecturally possible; **lightweight version shipped
  2026-09-09** (see below)
- **F** — proactive "these go well together" combination recommendations
  — can slot in alongside B/C, **still paused**
- **G** — mandatory post-generation "honest overview" with alternatives,
  strict tone requirements — **shipped 2026-09-09** (see below)

User's explicit choice: **"Start with G + lightweight E"**, then, after
reviewing a prototype comparison image, **"Go ahead and wire it in"** for
B. C, D, F remain paused — do not start any of them without further
explicit go-ahead, per the same "proper discussion first" instruction
that triggered this whole breakdown.

### B — Perspective/angle-correct projection, wired 2026-09-09

Prototyped in isolation first (a scratchpad script, homography math
against a synthetic angled test photo with hand-supplied corners) —
confirmed a true projective warp reads as genuinely perspective-correct
(grid lines converge to match the quad) vs. the naive flat-resize-and-clip
baseline (uniform grid, reads as a pasted sticker). User reviewed the
comparison and said "go ahead and wire it in."

**wall-detection.ts**: each candidate may now carry an optional `corners`
field — a 4-point quad (TL/TR/BR/BL) — populated ONLY when the model
judges the wall genuinely angled AND is confident of the exact shape;
null for the (overwhelmingly common) straight-on case or any uncertainty.
Never a guessed quad (Constitution Principle 4).

**visualization.ts**: when a confident quad AND a real reference texture
(a custom upload) are both available, `runQuickPreviewVisualization`
takes a SEPARATE, fully deterministic path — no Gemini image-generation
call at all:
1. Warp the real reference pixels onto the wall's exact quad via a
   homography (4-point DLT solve, 3x3 inverse, inverse-mapped bilinear
   sampling — plain arithmetic, `sharp` only for image I/O, no new
   dependency).
2. Approximate the room's real lighting with a coarse shading map (a
   heavily blurred greyscale of the ORIGINAL photo, normalized to the
   wall's own mean brightness, multiplied onto the warped texture,
   clamped to a modest range) — a deterministic relighting technique, not
   an AI guess, since trusting an AI model to redraw the pattern
   correctly would undermine the whole point of doing exact geometry
   ourselves.
3. Intersect the warped result's alpha with the outline polygon's mask
   (so an obstruction routed around in the outline — a window, a light
   switch — stays protected even where the quad geometrically overlaps
   it), feather the combined edge the same way the existing pipeline
   does, composite onto the original photo, upload.

Falls back to the existing Gemini path on any failure (degenerate quad,
missing reference image, etc.) or whenever a quad/reference isn't
available — fully backward compatible with the common case. New
`HmVisualization.perspectiveCorrected` boolean + `provider: "deterministic"`
/ `model: "homography+shading-v1"` make this path fully traceable in the
domain's own data, distinct from a Gemini-generated row. UI shows a
"Perspective-corrected" badge next to the existing product-accurate
badge when this path was used.

**Scope boundary (known, deliberate):** no corner-editing UI yet — the
AI's own `corners` are used as-is; if the user manually drags any outline
vertex afterward, `corners` is dropped entirely (RoomView.tsx's
`handleVertexPointerDown`) and the flow falls back to the standard path,
since a hand-edited outline makes the original quad's validity suspect
too. A future iteration could let users adjust the quad directly, but
that's out of scope for this pass.

**A real bug found and fixed while wiring this in:** `sharp`'s
`.removeAlpha().joinChannel(buf, {raw:{...}})` silently fails to attach
the joined channel (stays at 3 channels, alpha effectively lost) when the
base image has no alpha channel going in — discovered because the first
live-tested output came back with the entire background outside the
warped wall rendered solid black. `.ensureAlpha()` before `.joinChannel()`
works correctly (confirmed by isolating the exact call pattern in a
throwaway script) and matches the pattern the existing Gemini-path
compositing already used — fixed by swapping `.removeAlpha()` for
`.ensureAlpha()` in the new code.

Live-tested 2026-09-09: the AI's own judgment of a synthetic angled test
photo was genuinely inconsistent between runs (once split it into two
"walls" with corners populated, another run correctly judged both regions
"perfectly rectangular" and declined to guess corners at all — the
"never manufacture certainty" behavior working as intended, though it
means this particular synthetic image isn't a reliable trigger for the
new path). To directly exercise and validate the deterministic code path
itself, a hand-supplied quad matching the drawn geometry was used instead
— confirmed `provider: "deterministic"`, `model: "homography+shading-v1"`,
`perspectiveCorrected: true`, and the final composited image showed the
full room untouched outside the wall with a correctly perspective-warped,
plausibly-shaded checkerboard inside it.

### G — Honest overview, shipped 2026-09-09

`lib/home-material/overview.ts`: a `gemini-2.5-flash` vision-QA pass over
the FINAL composited image (not the pre-generation choice), run
automatically after every completed visualization
(`app/api/home-material/visualizations/route.ts`). Structured JSON output
(never prose): `{ opening, highlights[], considerations[], closing }`.
Tone is enforced two ways — strict prompt instructions (always-positive
opening, hedge doubt softly, forbidden blunt/negative words listed
explicitly) AND a belt-and-suspenders server-side filter that drops any
line containing a blacklisted word, so a bad model output can never reach
the user even if it ignores the prompt. Never shows a bare numeric score
to the customer.

Alternative products (1-3, always shown regardless of how good the
primary result is) are chosen **deterministically** from the product
catalogue (`pickAlternativeProductIds`, same-category-first) — never
AI-invented, per Constitution Principle 7. New `HmVisualization` columns:
`overviewStatus`/`overviewOpening`/`overviewHighlights`/
`overviewConsiderations`/`overviewClosing`/`overviewAlternativeProductIds`.
The overview is a soft feature — its failure is tracked separately
(`overviewStatus: "failed"`) and never blocks or hides an otherwise-
successful preview. Rendered client-side by `RoomView.tsx`'s
`OverviewCard`, with alternative swatches one tap away from re-previewing
(`handleGeneratePreview` now takes an explicit `productIdOverride` param —
fixed a latent stale-closure bug in the pre-existing "Preview this"
button while wiring this up, since both now share the same call pattern).

Live-tested 2026-09-09 against a synthetic two-wall test image — tone
came back clean (positive opening, one softly-hedged consideration,
positive closing, correct same-category alternatives), no forbidden
wording.

### Lightweight E — multi-wall detection, shipped 2026-09-09

`lib/home-material/wall-detection.ts`'s `detectWallRegion` now returns
`{ wallVisible, candidates: WallCandidate[], notes }` (up to 5
candidates) instead of a single polygon — each wall is an INDEPENDENT
region with no perspective-correction and no cross-wall continuity
guarantee (that's B/C, still paused). `app/api/home-material/rooms/
[roomId]/detect-wall/route.ts` returns `{ walls: [...] }`.

`RoomView.tsx`: the common single-wall case is unchanged (skips straight
into the existing adjust-and-confirm draft). When 2+ candidates come
back, they're shown as numbered polygons overlaid on the photo (click to
select) plus a text picker below; picking one enters the same
draggable-vertex draft flow as before. A candidate stays pickable until
actually confirmed as a surface — discarding a draft puts it back. The
"Detect wall automatically" button is now also available after the first
wall is confirmed ("Detect another wall"), so a user can pull additional
candidates from the same photo. Each confirmed wall keeps its own
independent material choice, generation, and overview — no shared-corner
awareness yet.

Live-tested 2026-09-09: a synthetic room-corner image (two flat-colored
walls meeting at a corner, with a piece of furniture against one wall)
correctly returned 2 candidates labeled "left wall"/"right wall", with
the furniture correctly excluded from its wall's polygon and mentioned in
`notes` rather than guessed through. The masked composite correctly
recolored only the confirmed wall, leaving the other wall, the furniture,
floor, and ceiling pixel-identical (aside from the known, already-
documented feather-halo cosmetic artifact at a hard geometric seam).

## Real bug found via manual testing: Gemini editing the wrong wall (2026-09-09)

User manually tested on an actual (large, real, multi-wall) bedroom photo
— selected the right-hand wall (a door + adjacent panel), tried both a
custom-uploaded wallpaper photo and a curated paint swatch ("Soft Sage").
Both came back showing almost no visible change on the selected wall.

**Root cause, isolated by comparing Gemini's raw edit candidate against
the mask we sent it:** the mask (`modelMask`, a separate black/white
image) was correctly positioned over the right wall — but Gemini's
actual edit painted the new material onto the CENTER wall instead,
ignoring the mask entirely. This wasn't a masking/geometry bug (confirmed
by testing both the AI-detected 7-point notched outline AND a clean
simple rectangle over the same area — both failed identically); Gemini
was simply defaulting to editing whichever wall it considered "the main
one" in a busy real photo with more than one wall in frame, rather than
correlating the separate mask image with the correct region.

**Fix:** `visualization.ts`'s new `renderOutlinedBase` bakes a bright
magenta outline directly onto the SAME photo sent to Gemini (in addition
to, not instead of, the existing separate mask), and the prompt now
explicitly says to edit only inside that outline and to exclude the
marker itself from the output. This doesn't weaken the existing safety
guarantee — the final composite still only takes pixels from within the
real, unannotated mask regardless of how well Gemini honors the outline
— it just makes it far more likely Gemini targets the correct wall in
the first place. Confirmed via live-testing: the same notched polygon,
simple rectangle, and the original wood-wallpaper reference image all
now correctly land on the right wall, with no trace of the magenta
marker in the final output.

This bug was pre-existing (part of the original Quick AI Preview
pipeline, unrelated to the 2026-09-09 B/E/G work) and had simply never
surfaced before because it only manifests on a real photo with more than
one visually plausible wall in frame — the user's own earlier
"manually verified on an actual room wall" test happened to use the
single dominant back wall, where there's no ambiguity for Gemini to get
wrong.

## Second real bug + reliability fix: retry-on-undercoverage (2026-09-09)

User tested a different wall (the left one, an irregular/tapering shape —
a wide wedge above a wardrobe narrowing into a thin sliver beside it) on
the same real photo, with the magenta-outline fix already live. One
generation came back visibly incomplete — "missed a part of the wall and
covered a section." Root-caused by comparing the magenta-outlined base
against Gemini's raw edit again: the outline was correct, but Gemini's
edit painted almost the ENTIRE back wall, ignoring the thin/irregular
outline shape entirely — our masking correctly clipped that back down to
the true selection (confirmed: outline shape and final composited shape
matched exactly), so nothing leaked outside the wall. The user's complaint
was really "the material barely shows up," not "it's in the wrong place."

**Critically, re-running the EXACT same polygon + product twice gave
different results** — one run covered the shape well, another barely
touched it. This is Gemini's own reliability varying between calls on a
hard (thin/irregular) mask shape, not a deterministic bug with one fix.

**Fix — retry-on-undercoverage, `visualization.ts`:**
- New `estimateMaskCoverage(original, edited, mask, w, h)`: downscales
  both images, converts to greyscale, and measures what fraction of
  pixels INSIDE the mask actually changed by a meaningful amount (≥12/255)
  — a coarse "did the edit really touch this region" signal, not a
  quality judgment.
- The Gemini call now runs in a loop (`MAX_ATTEMPTS = 2`): after each
  attempt, coverage is measured; if it clears `MIN_ACCEPTABLE_COVERAGE`
  (0.5) the loop stops early, otherwise it retries once more and keeps
  whichever attempt covered more.
- **Honesty floor:** if even the best attempt is still below
  `MIN_USABLE_COVERAGE` (0.15) after all attempts, the function now
  returns an honest error ("couldn't clearly apply the material... try a
  simpler wall selection, or try again") instead of silently uploading a
  near-blank result as a "success" — Constitution Principle 4 applied to
  a case that previously would have quietly shipped a bad result with a
  green checkmark.
- Every attempt is logged to the `AiUsageEvent` ledger individually
  (tagged with `attempt` and `coverage` in `metadata`) so a retry's real
  extra cost is visible, not hidden inside a single averaged row.
- A permanent, opt-in diagnostic hook (`HM_DEBUG_DIR` env var — unset by
  default, zero cost/behavior change) dumps the outlined base and each
  attempt's raw edit to a local directory; this is what made both this
  bug and the wrong-wall bug tractable to diagnose and is being kept for
  future troubleshooting.

Live-tested: reproduced the original low-coverage case (both attempts
scored 3-5% coverage — confirmed by eye that the result was genuinely
near-blank, correctly triggering the new honesty-floor error instead of
a false "success"), then a separate run where attempt 1 narrowly missed
the retry threshold (49.8%) and attempt 2 cleared it (54.1%), producing a
visibly well-covered result — confirming the retry mechanism improves
outcomes rather than just adding cost.

**Known remaining limitation, not fixed here:** a genuinely thin sliver
of wall (e.g. behind/beside furniture, only a few percent of the image)
may still legitimately fail even after retrying, and 2 attempts is a
cost/reliability tradeoff, not a guarantee. This is a per-generation
reliability mitigation, not a claim that irregular-shape coverage is now
100% solved.

## Wall-truncation honesty + real-dimension entry (2026-09-09)

Discussed before building (per the user's request) — see the design
recap in the memory file for the full back-and-forth. Core problem: when
a wall's real boundary extends beyond the photo (a side wall cut off by
the frame, not a real corner), geometry alone can't tell which case
applies, and area/cost estimates + the future repeat-pattern sheet-count
work both need a real physical dimension to work from.

**Detection — `wall-detection.ts`:** each candidate now carries
`possiblyTruncated: boolean`, judged in the SAME detection call (no extra
API cost). The model looks for real evidence — a corner line, a shadow,
an adjoining wall, a ceiling/floor convergence — where its outline ends;
absent that evidence, it flags true. Missing/malformed data defaults to
`true` (flag it) — never assume the full wall is captured without
evidence.

**Schema — `HmSurface`:** added `possiblyTruncated Boolean @default(false)`.
Reused the ALREADY-EXISTING but previously entirely unused
`widthMeters`/`heightMeters`/`areaSqm` fields from the Phase 1 schema for
the optional real-dimension entry — no new dimension fields needed.

**New endpoint:** `PATCH .../surfaces/[surfaceId]/dimensions` — sets or
clears `widthMeters`/`heightMeters` (UI takes feet, India convention;
stored as meters, schema-literal unit, same as `HmLead.estimatedAreaSqm`),
computing `areaSqm` when both are present. Deliberately separate from the
shape-reshape PATCH (which always requires `points`) since dimension
entry is an orthogonal fact about the physical wall, not the traced
outline.

**UI — `RoomView.tsx`'s `WallDimensionsNotice`:** renders nothing unless
`possiblyTruncated` is true. Shows a plain warning + an optional
width/height (ft) entry form; once set, shows "Wall size: X ft × Y ft"
with an edit link. Never blocks anything — a wall with no dimensions set
just keeps estimating from the visible photo portion, exactly as before
this existed. `CostEstimator` now accepts `initialAreaSqft` and
auto-fills the area field from the wall's known `areaSqm` once set
(converted to sqft) — still fully editable, never overwrites something
the user already typed (state adjusted during render, not via a
`useEffect` calling setState, to avoid a cascading-render lint issue).

Live-tested end to end in the actual browser (not just via script): a
synthetic room where one wall's left edge has no corner evidence (main
wall) and both candidates' remaining frame-touching edges genuinely lack
corner evidence too — detection correctly flagged BOTH as
`possiblyTruncated: true`, matching the honest reality of that image.
Confirmed the warning renders, the width/height (12 ft × 9 ft) form
saves correctly via the new endpoint, "Wall size: 12 ft × 9 ft" displays
with a working Edit link, and the cost estimator auto-filled 108 sqft
(12×9) with the correct total.

**Deliberately out of scope for this pass** (per user's explicit
sequencing): the wallpaper sheet-size/repeat-pattern scaling work itself
— this only builds the shared dimension-entry foundation that work will
extend, not sheet-count calculation or repeat-pattern-aware rendering.

### Follow-up fixes from the user's own real-photo retest (2026-09-09)

Two issues surfaced immediately from real usage:

1. **Rounded card corners clip vertex handles.** The room-photo container
   uses `rounded-2xl` + `overflow-hidden`; a draggable vertex placed right
   at the image's own corner (where a real wall corner often is) was
   visually clipped by the curve, making it hard to see/grab precisely.
   Fixed: `RoomView.tsx`'s image container drops rounding (keeps
   `overflow-hidden`, now clipping a plain rectangle) during any active
   editing (`isAdjustingDraft || manualDrawing`), and rounds again once
   idle — a targeted interaction fix, not a broader restyle (UI polish
   otherwise stays paused pending the user's reference designs).

2. **No truncation warning appeared for a wall that clearly needed one.**
   Root-caused by re-running detection on the user's own already-uploaded
   real photo: the model flagged the exact same wall/shape `true` in that
   fresh call, confirming the code path works — but the user's actual
   test apparently got `false` for it. This is genuine model-to-model
   variance on the SAME photo (already observed repeatedly this session —
   the same image has produced 2, then 4 different wall-candidate splits
   across separate calls), not a code bug.

   **Fix — a deterministic geometric safety net under the AI's semantic
   judgment:** `wall-detection.ts`'s new `hasFrameAlignedEdge(points)`
   checks whether a WHOLE polygon edge (both endpoints, not just one
   corner) runs along the image's own left/right/top/bottom border — a
   real wall boundary (a ceiling line, a corner shadow) essentially never
   aligns perfectly with the photo's rectangular edge by coincidence, so
   this is strong, specific, and directly inspectable (no extra API call
   needed). `possiblyTruncated` is now `modelSaidTruncated ||
   hasFrameAlignedEdge(points)` — geometry can only ADD caution, never
   remove it; the model can still flag something geometry alone wouldn't
   catch (e.g. an obstructed but not frame-touching wall).

   Verified by hand-tracing the exact polygon from the user's screenshot
   (`[{0,0.22},{0.29,0.22},{0.29,0.6},{0,0.6}]`) — the left edge (both
   points at x=0) correctly triggers the override. Cross-checked the
   "Back wall" candidate from the same photo (real wardrobe/door corner
   evidence, no frame-touching edge) does NOT get force-flagged — the
   heuristic stays targeted, not overly aggressive.

## Wallpaper sheet-size / repeat-pattern scaling (2026-09-09)

Discussed at length before building (per the user's request) — the full
back-and-forth (sheet-count math derivation, the adjacency rule, the
decision to keep adjacency manual) is worth reading in the memory file
if picking this up cold. Core problem the user identified: every
material was being rendered as if it's one customizable image stretched
to fit the wall, which is wrong for real repeat-pattern sheet goods (a
mandala motif shouldn't visually become one giant mandala the size of
the wall) — and there was no way to calculate how many physical sheets
an order actually needs.

### Data model — `HmProduct`

New fields (mandatory at the API/upload-form layer, not just a silent
DB default): `patternType` ("customizable" | "repeat_sheet"),
`sheetWidthM`/`sheetHeightM` (required when `repeat_sheet`),
`minWidthM`/`minHeightM` (optional, customizable's "can't shrink below
this" floor). Supersedes the old free-text `dimensions` field's
deferred intent for repeat-pattern goods specifically. A product's
uploaded reference photo is assumed to depict exactly one full sheet —
a deliberate simplification rather than tracking a separate "what area
does this specific photo show" dimension.

### Sheet-count math — `lib/home-material/sheet-calculation.ts`

Verified against the user's own worked example before writing any
integration code: sheet 10m×1.5m on a 12m×9m wall → 12 sheets
(ceil(12/10)=2 cols, ceil(9/1.5)=6 rows, 2×6=12). Always uses the
"horizontal" orientation (sheet's long side along the wall's width) —
the user's explicit simplification, never compares against a vertical
alternative.

**Adjacency rule** (confirmed via a second worked example): if 2+ walls
using the SAME product are marked adjacent (share a real corner), their
widths are SUMMED into one continuous run before the ceiling formula
applies once — 12m + 15m wall run → ceil(27/10)=3 × ceil(9/1.5)=6 = 18
sheets, not 12+12=24 computed separately. Matches how wallpaper is
actually hung continuously across a corner, with less material waste.
Non-adjacent walls are computed independently and summed.

**Adjacency is deliberately manual, never AI-detected** — auto-detecting
real physical adjacency from a photo is sub-problem A from the
multi-wall discussion (2026-09-09), explicitly paused pending its own
conversation. `HmSurface.adjacencyGroupId` is a user-confirmed fact only,
set via the new `PATCH .../surfaces/adjacency` endpoint (2+ ids → shared
new group; 1 id → removed from any group) and RoomView.tsx's
`AdjacencyMarker`, shown only when 2+ confirmed walls share the same
repeat_sheet product selection.

Verified with the unit tests in the user's own examples: single wall
(12 sheets), two adjacent walls (18), two independent walls (24) — all
matched exactly before any UI was built.

### True-scale tiled rendering — `visualization.ts`

A THIRD deterministic path (alongside sub-problem B's perspective
homography), gated on: `repeat_sheet` product, no `corners` (straight-on
walls only for this pass — combining tiling with perspective correction
is deferred, same scoping decision as sub-problem B originally got), and
BOTH the wall's and the product's real dimensions known. Computes
pixels-per-meter from the wall's photographed bounding box vs. its real
size, resizes the reference texture to one real "tile" at that scale,
repeats it across the bounding box (`renderTiledPattern` — plain 2D grid
compositing, not novel math, which is why this didn't need an isolated
prototype phase the way the homography work did), applies the same
shading-map relighting and feathered-mask compositing already proven in
the perspective path. Falls through to the existing Gemini path when any
condition is missing — never blocks a preview for lack of this data
alone.

New `HmVisualization.trueScaleRendered` boolean + `model:
"tiled-true-scale-v1"` for full traceability, mirroring how
`perspectiveCorrected` already works. UI badge "True-scale pattern" next
to the existing mode/perspective badges.

### Reference-object dimension estimation — `lib/home-material/scale-estimation.ts`

Per the user's explicit instruction: when a repeat_sheet product is
selected and the wall's real size isn't known, try to estimate it from a
common object of well-known typical size visible in the photo (a door,
wardrobe, bed, sofa, chair) before asking the user for anything — the
same technique real AR measurement apps use. Reuses the magenta-outline
technique from `visualization.ts`'s `renderOutlinedBase` to point the
model at the right wall. Never guesses without a real reference object
(`referenceObjectFound: false` → `unavailable`, Constitution Principle
4) — a successful estimate is stored on the surface with
`dimensionsEstimated: true` (a new honesty flag, matching the "never
blur estimate vs. confirmed" rule `measurementSource` already follows).

**Blocking behavior** (per the user's explicit instruction — an
intentional, scoped exception to this domain's usual "always optional,
never blocking" pattern, since a repeat-pattern preview genuinely can't
be scaled sensibly with zero information): the FIRST preview attempt for
a repeat_sheet product with no known wall size tries the estimate
automatically; if that fails too, the API returns `needsDimensions: true`
and RoomView.tsx's `NeedsDimensionsPrompt` blocks that one attempt with
an inline form (enter width/height, or "Continue anyway" — which passes
`skipDimensionCheck` and falls back to today's stretch-to-fit rendering).
Once resolved either way, the wall's dimensions are set and nothing
blocks again for that surface.

### Live-tested end to end (2026-09-09)

API-level (zero AI cost, manually-entered dimensions): uploaded a
repeat_sheet product (rejected correctly without `patternType`; accepted
with sheet size 2m×1m), confirmed two independent wall rectangles, set
Wall A to 3m×2m and Wall B to 4m×2m, marked them adjacent, generated a
preview for Wall A — confirmed `provider: "deterministic"`, `model:
"tiled-true-scale-v1"`, `trueScaleRendered: true`, and the output image
showed a checkerboard tile repeating at a uniform, consistent scale
across the wall (not stretched into one giant checker), correctly masked
to only the selected wall.

Reference-object estimation: live-tested against the user's own real
bedroom photo — found a standard interior door, used it to estimate a
narrow wall section's real size, returned a plausible small estimate
(0.75m × 0.9m) with a stated confidence — confirming the mechanism works
(finds a reference, calibrates, returns typed data) even though the
exact number is inherently a best-effort AI estimate, not a
measurement.

Browser-verified: the mandatory pattern-type selector and conditional
sheet-width/height fields render and toggle correctly on the custom
upload form.

**Deliberately out of scope for this pass**: combining true-scale
tiling with perspective correction (angled walls) — falls back to the
existing behavior for that specific combination; AI-detected adjacency
(sub-problem A, still paused).

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
- ~~Wallpaper/material sheet-dimension-aware rendering~~ — **shipped
  2026-09-09**, see "Wallpaper sheet-size / repeat-pattern scaling"
  above (data model, sheet-count math with the adjacency rule,
  true-scale tiled rendering, reference-object dimension estimation).
  Explicitly NOT combined with perspective correction (angled walls)
  this pass. Adjacency is now AI-suggested (never auto-saved) — see
  "Sub-problems A, C, F" below, shipped 2026-09-10.
- ~~Walls whose true length isn't visible in the photo~~ — **shipped
  2026-09-09**, see "Wall-truncation honesty + real-dimension entry"
  above (detection flag + warning + optional real-dimension entry,
  reusing the wallpaper sheet-scaling item's dimension needs).
- **UI polish: room-photo selector card has rounded corners** (noted
  2026-09-09) — `RoomView.tsx`'s image container uses `rounded-2xl` +
  `overflow-hidden`, which can make it fiddly to place/grab a polygon
  vertex exactly at one of the image's 4 corners (the rounding clips the
  interactive area right at the corner). Low priority, **next up** —
  user confirmed 2026-09-10 this is the item after sub-problems A/C/F.
- **Sub-problem D (panoramic/wide-angle)** — user explicitly confirmed
  2026-09-10 to keep this permanently deferred, not attempted.

## Sub-problems A, C, F — shipped 2026-09-10 (D stays deferred)

Continuation of the 2026-09-09 multi-wall discussion's taxonomy (A–G).
G, E, B shipped 2026-09-09 (see above). This round, after a dedicated
scoping conversation (same pattern as before — align on approach before
any code), the user chose to build **A, C, and F now**, keep **D
permanently deferred**, with **UI visual polish next** after this.

Scoping decisions confirmed before writing any code:
- **A (AI-detected adjacency):** "AI suggests, user confirms" — never
  replaces the existing manual `HmSurface.adjacencyGroupId` confirm step.
- **F (combination recommendations):** scoped as **both** same-wall
  layered combos (e.g. paint + wainscoting on one wall) **and** cross-wall
  room combos (a feature wall + complementary paint on the rest).
- **C (cross-wall pattern continuity):** wall order within an adjacency
  run is **inferred from geometry** (each wall's mean X position in the
  photo), never asked of the user.
- **D (panoramic/wide-angle):** stays deferred, per the original
  recommendation.

### A — AI-suggested adjacency

`lib/home-material/adjacency-detection.ts`'s `detectAdjacentWalls` —
bakes a distinctly-colored, lettered outline onto each candidate wall in
the SAME photo (extending the established `renderOutlinedBase`/
`renderOutlinedPhoto` technique to multiple walls at once) and asks
Gemini which labeled walls share a real physical corner, citing visual
evidence (a corner line, a continuous ceiling/floor line). Suggest-only:
returns groups to the caller, never writes `adjacencyGroupId` itself — a
wall pair the model isn't confident about is left ungrouped, never
force-grouped (same "never manufacture certainty" rule as the rest of
this domain).

New `POST .../rooms/[roomId]/surfaces/adjacency/suggest` (auth +
ownership checked, same pattern as the existing manual PATCH endpoint).
`RoomView.tsx`'s `AdjacencyMarker` gained a "Suggest adjacency (AI)"
button — each suggested group renders with its confidence/reason and a
"Select these" action that pre-checks exactly that group's boxes; the
user still clicks the pre-existing "Mark selected as adjacent" button to
persist anything. Multiple disjoint suggested groups (e.g. two separate
adjacent pairs in a 4-wall room) are shown as separate selectable rows
rather than blended into one checkbox soup.

Live-tested against a synthetic two-wall corner photo (a real vertical
corner shadow line between the walls) — the model correctly grouped both
walls with confidence 1.0, citing "share a common vertical edge... meet
at a physical corner," matching the scene's ground truth exactly.

### C — cross-wall pattern continuity

Only affects the existing true-scale tiled-rendering path (repeat_sheet,
no perspective corners — same scoping boundary sub-problem B already
established). `QuickPreviewInput.adjacencyOffsetM` (meters) — the
combined real width of every OTHER wall in this wall's adjacency group
that sits before it in left-to-right order — phase-shifts the tile grid
so the pattern continues from the previous wall instead of restarting at
column 0 on every wall.

`visualization.ts`'s `renderTiledPattern` implements the shift by
rendering onto a canvas padded wider by the offset, then cropping the
padding away — deliberately avoids compositing a tile at a negative
`left` coordinate. New `HmVisualization.adjacencyContinuityApplied`
column (mirrors `perspectiveCorrected`/`trueScaleRendered`'s existing
traceability pattern) + a "Continues from adjacent wall" badge in
`RoomView.tsx`.

Order is inferred, never asked: `app/api/home-material/visualizations/
route.ts` fetches every wall sharing this wall's `adjacencyGroupId`,
sorts them by mean polygon X in the same photo, and sums the real widths
of everything before this wall in that order. If any sibling is missing
a saved outline or a real width, this silently stays null (today's
independent-phase behavior) rather than guessing an order — same
"never blocks, never guesses" pattern as the rest of this feature.

Verified two ways: (1) an isolated unit-level check of the phase-shift
math with a 2-color test tile (a full-tile offset is a correct no-op;
a half-tile offset correctly starts the pattern on the other half-color)
— confirms the modulo/pad/crop logic is exactly right; (2) an end-to-end
call through `runQuickPreviewVisualization` with two adjacent walls (3m
and 4m) confirmed `adjacencyContinuityApplied` is only set true when a
real offset applies, false for the first/only wall in a run.

### F — combination recommendations

`lib/home-material/combination-recommendation.ts` — same architectural
level as the existing `recommendation.ts` scorer (taxonomy-level,
deterministic, explainable); adds a category-PAIRING layer on top of it,
does not re-score materials itself. Deliberately does NOT build real
per-product color-harmony matching (HmProduct does carry `colorHex`, but
a genuine color-theory algorithm would duplicate complexity the fashion
side's protected `color-harmony.ts` already owns for a different domain,
and goes beyond what was scoped) — stays at "which material TYPES combine
well," the same level the rest of this recommendation engine operates at.

- `generateSameWallCombinations` — a fixed compatibility table of which
  category PAIRS work layered on one wall (paint+wall_panel and
  wallpaper+wall_panel: high — wainscoting conventions; paint+wall_texture,
  paint+wallpaper, wall_panel+wall_texture: medium; wallpaper+wall_texture
  deliberately excluded — two full-coverage patterned/textured treatments
  on one wall reads as visually busy). Picks the best-scoring taxonomy
  entry per category against stated requirements, combines scores.
- `generateRoomScheme` — cross-wall: one feature wall (best-scoring
  wallpaper or wall_texture) + a complementary paint for the rest of the
  room's confirmed walls. Needs 2+ confirmed walls to mean anything.

New endpoints: `POST .../surfaces/[surfaceId]/recommend-combinations`
(same-wall) and `POST .../rooms/[roomId]/recommend-scheme` (room-wide).
Both are **ephemeral** — computed fresh every call, never persisted to
`HmRecommendation` (unlike the single-material picks) — no schema change
needed for this pass, and combos are cheap enough to recompute. Revisit
if combo shortlisting/history is wanted later. `RoomView.tsx` gained an
"Or combine two materials on this wall" action inside the existing "Help
me choose" panel, and a room-level "Suggest a room scheme" section.

Live-tested via a direct script (fully deterministic, zero AI cost):
confirmed category-pair scores differentiate correctly across two
requirement scenarios (a wet-area/budget/durability case correctly
re-ranked `wall_texture+wall_panel` above `paint+wallpaper`, versus the
"any" case's default ordering), and confirmed a 1-wall room correctly
returns `null` (no scheme) while a 3-wall room returns a real one.

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
