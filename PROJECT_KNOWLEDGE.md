# Project Knowledge

Evolving, curated knowledge for Product Match: business rules, architectural
decisions, hard-won gotchas, and process standards that outlive any one
feature's implementation. Referenced by `CLAUDE.md` §1/§6/§21.

This file is the durable home for what used to live in per-feature research
docs under `docs/research/` — those docs are session logs, written while a
feature was being built and meant to be temporary; once a feature ships, the
decisions and lessons worth keeping get folded in here and the log is
deleted. `docs/IMAGE_AI_ROADMAP.md` remains the architecture/roadmap
reference for the image-generation system specifically; this file covers
everything else plus cross-cutting lessons.

---

## Engineering standard: a fix isn't done until it's structural

Recurring principle from the saree-craftsmanship work, worth applying to any
AI-pipeline bug fix in this codebase: **a fix only counts once it's a schema
field, a taxonomy entry, or a deterministic prompt clause that every future
product runs through — not a change tailored to make one sample's photo look
right.** The failure mode this guards against: a fix that visibly improves
the one product you tested on but doesn't generalize, because the underlying
rule was never actually encoded anywhere durable (schema, prompt-render
logic, or extraction prompt) — it just happened to work for that input.

Related process lesson (from a 2026-07 incident): a fully-shipped,
phase-tracked "done" branch was never merged to main, so main silently ran
stale logic for a period; separately, the same small bug (a raw
`datetime('now')` SQLite-ism left over from the Postgres migration) was
independently fixed on two different branches before either reached main.
**Before assuming a reported defect needs new code, check for a stranded
branch that may have already fixed it.**

---

## Image generation pipeline

### Resolution and hallucination risk

Native output resolution is a deliberate tradeoff, not "higher is free
quality." Local A/B benchmarking (2026-07-03) found that at 1K, borders/motifs
reproduce faithfully; at 4K, the model has been observed to **fabricate
detail that isn't on the real product** — one case produced an ornate
"temple gopuram" architectural motif on a saree border that doesn't exist on
the source photo at all. The automated AI-reviewer score (`ai-review.ts`)
did **not** catch this as a structural error, scoring it a middling 3/5 for
"smeared zari border" — the reviewer has a **documented blind spot for
structural/pattern drift**, not just quality degradation. Practical
implications:
- Production `imageConfig.imageSize` default stays at 1K/2K (see
  `lib/model-gen/quality.ts`) — never default to 4K.
- The AI-reviewer's numeric score is not sufficient evidence that a
  generation is structurally faithful to the source product. Human spot
  review remains the real check for pattern/motif accuracy, especially at
  higher resolution or novel categories.

### Storage and re-encoding

Gemini bills per response and **retains nothing server-side** — an image
that isn't stored by this app immediately is unrecoverable; regenerating it
is the only recovery path, at full price again. This motivated the layered
protections around the Cloudinary upload step in `runGeminiImageGen`
(`lib/generate-model-image.ts`): a pre-flight reachability check, a 120s
timeout with one retry (`uploadWithRetry`), and — even when upload still
fails — recording the AI usage event anyway so a paid generation is never
silently missing from the cost ledger.

Gemini's own JPEG encoder is not size-optimal. Re-encoding immediately after
generation (`lib/images/reencode.ts`, mozjpeg quality 90) shrinks output to
roughly 17-19% of Gemini's original size at 1K/2K/4K with no perceptible
quality loss on detail crops (embroidery, zari, lace) — confirmed via local
A/B, not a guess. Format comparison from the same investigation: mozjpeg q90
≈ 17-19% of original, WebP q80 ≈ 6-8%, AVIF q70 ≈ 4-6%, PNG lossless is
2.5-3× **larger** than the original (never use PNG for a photographic
master). AVIF was considered and rejected for the stored master specifically
— universal compatibility matters more than the extra savings for a
source-of-truth asset that other integrations/tools/export paths need to be
able to open.

### Preprocessing — check every image path gets the same treatment

A real cost bug (found via audit, since fixed): product images were being
preprocessed/downscaled before every Gemini call, but reference-model images
were sent unprocessed — same call, asymmetric treatment. Fixing that
brought reference-model payloads down ~97% on average. **The general lesson:
when multiple images go into one generation call (product + reference +
region refs + mask, etc.), verify every one of them goes through the same
preprocessing pipeline, not just the obvious "main" one** — this class of
bug is easy to reintroduce whenever a new image input is added to a call
(e.g. the erase feature's mask/reference inputs — see `lib/model-gen/erase.ts`,
which does route the reference image through `preprocessProductImage` for
this reason).

### Deliberately-rejected optimizations (don't redo without re-reading this)

- **AI Review QA** sends full-resolution images, not downscaled — downsizing
  could plausibly shift `patternPreservation`/`textureQuality` scores, and
  touching the scoring subsystem's inputs wasn't worth the token savings.
- **Try-on's product-image input** was deliberately left unpreprocessed —
  try-on sits closer to the higher-stakes "preserve the person's face/skin
  tone exactly" requirement than catalogue generation does.
- **Fashion Designer's per-accessory calls were deliberately NOT batched** —
  batching changes the model's reasoning context; analyzing accessories
  together instead of in isolation risked cross-contaminated results (e.g. a
  placement suggestion referencing the wrong accessory).
- A perceived overlap between the reference-branch prompt instruction and
  `detailNotes` text was investigated and found to be **additive detail, not
  duplication** — trimming it was rejected as a wording experiment with
  unclear payoff.

### Cloudinary transform gotchas

- **`b_blurred` is not a valid Cloudinary background token.** Cloudinary
  parses it as a literal colour named "blurred," which doesn't exist, and
  the request 400s. This silently blanked every affected image until
  root-caused via the demo-cloud transform validator. If a padded/framed
  image transform starts failing, check the background token first.
- Verified working transform recipes: base shots use
  `c_pad,ar_3:4,w_1200,b_auto:border` (pads to 3:4, extends the edge colour
  into the bars); crops/close-ups use `c_fill,g_auto,ar_3:4,w_1200`
  (crop-to-fill, no padding).
- Branding overlay is always spliced in as the **last** transform segment,
  immediately before the `/v<version>/` path component — inserting it
  earlier would brand the pre-crop base and then crop the mark off.
  `lib/model-gen/branding.ts` (`applyBranding`) and
  `lib/model-gen/erase.ts` (`stripCloudinaryTransforms`, which removes only
  that branding segment by content-match, not position — so it survives a
  crop transform staying in place) both depend on this convention.

### Catalogue card sourcing (saree example)

Per-card source of truth, current shipped behavior
(`lib/product/part-slots.ts` `CARD_STACK`, `lib/model-gen/catalogue-cards.ts`
`resolveCatalogueStack`): Front/Back are AI base generations; Pleats is
always a crop of the Front base; Pallu and Blouse are crops of Back/Front
respectively unless `USE_UPLOADED_PART_IMAGES` is re-enabled (currently
`false` — every crop-eligible card uses the base-shot crop even when the
retailer uploaded their own part photo for that slot; the upload branch is
intentionally kept in the code, not dead, for whenever that decision is
revisited). **The pallu crop comes from the BACK base image (the spread
drape), not the front** — easy to get backwards; the pallu physically
displays on the back of a worn saree, not the front torso view.

---

## Garment Intelligence (structured craftsmanship analysis)

One deep vision pass per product (cached, reused everywhere) that extracts
*what makes this garment unique* — construction, surface technique, pattern,
texture — separately from basic metadata extraction (*what is this
product*). Feeds the generation prompt so fine craftsmanship detail isn't
lost during synthesis. Gate: `ENABLE_GARMENT_INTELLIGENCE`.

### Why structured JSON, not prose

- **One extraction, many renderings** — the same structured record can later
  power descriptions, search, and recommendations without another vision
  call.
- **Auditability** — the generation prompt fragment is a pure function of
  the stored structure (`lib/garment-intelligence/render.ts`), so a
  regression can be bisected as "wrong analysis" vs "wrong rendering of a
  correct analysis," instead of re-reading opaque prose every time.
- **Provider portability** — swapping the vision model later doesn't require
  redesigning the consuming prompt logic.
- Field values are deliberately **loose strings, not enums** — clamping
  vision output to a fixed enum at extraction time would discard exactly the
  nuance (e.g. "shadow-work bakhiya" flattened to generic "embroidery") this
  feature exists to capture.

### Why two passes, not one

Pass 1 (whole image) proposes the regions worth a close look; pass 2 (a
single batched call over all close-ups) analyzes them at native pixel
density. Pass-1 output is a *precondition* for pass 2 — one call can't do
both — but pass 2's cost doesn't scale with region count since every close-up
ships in one batched request, not N separate calls.

Model choice: `gemini-2.5-flash`, not the cheaper `flash-lite` tier —
judging *physical relief from a photo* (raised vs. flat, woven vs. applied)
is the hard part of this task, and the cheapest tier is the wrong place to
economize on a call that only runs once per product (cached after that).

Metadata extraction, detail-notes, and Garment Intelligence are deliberately
**separate calls, not merged into one** — merging would force GI to trust an
unconfirmed category guess, and would move its cost onto every upload
instead of only products that actually get generated.

### Construction method determines whether "flat" is correct or a bug

The single most load-bearing distinction in the schema
(`lib/garment-intelligence/types.ts`, `render.ts`): a technique **woven into
the fabric structure itself** (jacquard, brocade) is authentically
low-relief — rendering it flat is *correct*. A technique **applied onto the
surface after weaving** (embroidery, appliqué, stitched thread, stonework)
is genuinely raised regardless of how a given photo happens to be lit, and
needs an explicit dimensional instruction in the prompt even when the source
photo's lighting makes it look flat. A photo alone can't reliably
distinguish the two — this has to be judged from what the technique
physically *is*.

Reconciliation rule (added 2026-08-09 after a retailer bug report): when a
retailer-uploaded macro close-up (the most reliable evidence available)
reports raised/applied construction for content the whole-image pass called
flat/woven, the close-up wins — `render.ts`'s `contradictedByRegionEvidence`
downgrades the technique out of the "keep flat" bucket rather than emitting
a confidently wrong "do not add raised texture" instruction.

### Why real images beat text notes for surface fidelity

Gemini doesn't caption-then-generate — it encodes each input image into
visual tokens and attends to them directly during generation. A text note is
a few hundred tokens; an actual region crop is hundreds of visual tokens
carrying exact spacing/texture/relief information a caption can't restate.
Text is a narrow straw; the image is a firehose of the same information.
This is the rationale behind region-image-conditioning
(`lib/garment-intelligence/region-references.ts`, gate
`ENABLE_GI_REGION_REFERENCES`) — sending the actual macro pixels, not just a
description of them, whenever it's cheap enough to do so.

### Saree/dupatta anatomy vocabulary (schema v3)

- **Geometric border rule, orientation-invariant, never inferred from photo
  framing**: the border runs along the two LONG edges of the cloth (the full
  length); the pallu is the SHORT edge at one end. To tell top border from
  bottom: stand at the pallu edge, face into the body, fabric right-side-up
  — the border on your right hand is the TOP border, on your left is the
  BOTTOM border, which is the one nearest the wearer's feet and anchors the
  front pleats.
- **Boota vs. buti, discrete vs. continuous**: a *discrete* buti crop is
  evidence for both layout and texture (a real repeatable unit); a
  *continuous*/jaal motif crop is texture evidence ONLY — never treat it as
  a stamped, tileable unit. Getting this wrong means the generator either
  stamps a continuous pattern as if it were a repeatable motif, or ignores
  real layout information.
- **Five pallu/border relationship types** worth naming explicitly:
  same-design-rotated-90°, density-variant (same motif, denser on pallu),
  boxed pallu (border continues as a frame around a distinct interior
  design), fully independent designs, and nested/double-framed boxed pallu.
- **Border-adjacent buti bands are a deliberate design choice, not
  coincidence** — concentrated decorative work is placed there specifically
  because it shows prominently at the front pleats when draped. A real
  fashion-design rationale from a retailer, not an engineering guess.
- **Absence is information too** — the schema must support asserting an
  explicit negative ("this zone has no buti," not silence) — a generator
  given no negative signal will default to inventing plausible detail where
  none exists. This generalizes the older back-view fallback pattern
  (`renderBackFallbackNotes`) to every zone, not just the back.
- **When no pallu-specific evidence exists at all** (no upload, no distinct
  content detected), default to "same design as border, rotated" rather than
  leaving the field open for the generator to invent something — silence
  should mean "assume no difference," never "make something up"
  (`analyze.ts`'s deterministic default for `palluRelationship === "unknown"`).

### Known prompt-engineering failure modes on this pipeline (all previously observed, not theoretical)

- **Recency/position bias** — an instruction placed earlier in a long prompt
  gets weaker adherence than one placed at the very end. Fixed once already
  for camera-orientation instructions by moving them to the end of every
  view prompt; apply the same fix if a new instruction seems to be getting
  ignored despite being present.
- **Prompt-budget trimming can silently drop the wrong thing** — the
  renderer caps the rendered notes fragment at a fixed character budget and
  trims low-priority items first; a bug in the original priority order
  briefly caused genuinely important structured facts (pallu relationship)
  to lose out to a low-value verbose region-detail dump. When adding a new
  fact to the rendered prompt, put it in `core` (never trimmed) if losing it
  would actively mislead the generator, not just if it's "nice to have."
- **Over-anchoring** — more descriptive text has previously made results
  *worse*, not better; a longer, more specific instruction isn't always
  stronger.
- **Scale/extent drift** — a reference successfully taught the right pattern
  but rendered it at the wrong scale (longer than the real garment). Pattern
  correctness and scale correctness are separate risks; verifying one
  doesn't confirm the other.
- **Two independent mechanisms don't automatically compose**: the
  model-proposed ROI system flexes in count but only feeds text; the named
  region-conditioning system feeds real pixels but only for a fixed small
  set of slots. A product with more distinct zones than the fixed slot count
  falls between both mechanisms — neither alone is sufficient. Worth
  remembering if a future product needs more than ~2-3 distinguishable
  conditioned regions.

### Limitations, current as of the schema-v3 work (verify before relying on these being fixed)

Population-counting and precise zone attribution are still the weakest part
of extraction — undercounting a second buti population, or misattributing
sheer-fabric bleed-through as real content in the wrong zone, are both
observed failure modes. Region-image-conditioning did **not** reliably fix a
confined-population misplacement problem in live testing — in one run it
made coverage read as more spread out, not less; this is the direct
motivation for the mask-based "erase"/fix-region feature (see below) as the
real backstop for this specific failure class, not a sign region
conditioning was pointless (it did measurably help mirror-work and general
texture richness). Non-saree categories were never actually tested against
the v3 schema's garment-agnostic fields, even though they should
architecturally apply.

---

## Erase / fix-region feature

Lets a retailer paint over a specific wrong region on an already-generated
catalogue image and regenerate only that region, instead of risking a full
re-roll introducing a new problem elsewhere. Originated from the Garment
Intelligence region-conditioning limitation above.

Key architectural choice: does **not** trust Gemini to respect a painted
mask boundary — its `generateContent` API has no structured mask parameter,
unlike a dedicated inpainting endpoint. Instead, the full-image edit
candidate gets composited against the original using the mask afterward
(`lib/model-gen/erase.ts`) — that composite is what actually guarantees
everything outside the painted region stays pixel-identical, regardless of
how well the model behaved.

Persistence is one-step undo (`ProductImage.previousUrl`/`editedAt`), not
full version history — smallest schema footprint that still lets a bad edit
be reverted once. The retailer's pricing note from this era, still relevant:
`nano-banana-2`'s output rate was found to be priced at half Google's real
rate and was corrected against an actual GCP invoice; `nano-banana-pro`'s
real billing is closer to flat-per-image-by-resolution than a token rate, so
its current cost estimate is an approximation, not verified against an
invoice the way `nano-banana-2`'s was.

Real bugs found and fixed while building this feature, worth remembering if
touching mask/compositing code again:
- **sharp/libvips silently reorders `.threshold()` to run BEFORE `.blur()`**
  when both are chained on one pipeline, regardless of JS call order —
  verified empirically (a mask-dilation edge moved 1px instead of the
  expected ~20px). Fix: materialize an intermediate buffer between the two
  operations so they run as genuinely separate pipelines.
- A hand-painted mask that only traces an object's outline, not its
  interior, produces a mask that's a thin ring — almost nothing gets edited.
  Closed-loop strokes now auto-fill their interior.
- Removal-style corrections ("this is extra, remove it") need an explicit
  "erase, don't restyle" instruction — a generic correction prompt defaults
  to preserving the same shape/structure and just adjusting color/texture.
- A removed object's cast shadow/reflection typically extends past its own
  silhouette and past a hand-painted mask — mask dilation (grow the painted
  region by a margin before compositing) catches this without requiring the
  retailer to trace shadows precisely.
