# Garment Intelligence — R&D

Dedicated R&D document for the **Garment Intelligence** pipeline stage: deep,
structured, reusable understanding of *what makes a garment unique*. Companion
to [`IMAGE_RND_LOG.md`](IMAGE_RND_LOG.md) (the image-generation benchmark log)
and [`../IMAGE_AI_ROADMAP.md`](../IMAGE_AI_ROADMAP.md) (shipped-architecture
source of truth). Everything here lives on branch `rnd/garment-intelligence`
and is flag-gated (`ENABLE_GARMENT_INTELLIGENCE`, default **off**) — merging
the branch changes no production behavior until the flag is turned on.

---

## 2026-07-13 — Motivation and originating evidence

### The business problem

Catalogue generations frequently lose the **physical character of surface
work**. Chikankari, zari, mirror work, bead work, sequins, applique, lace,
crochet, quilting, smocking, jacquard — anything that lives *above* the base
fabric — tends to come back rendered as printed artwork / painted texture /
flat design instead of raised thread work, dimensional embroidery, layered
craftsmanship. For a platform whose output represents retailers' real
products, converting handcrafted embroidery into what looks like a flat print
**misrepresents the product**. The bar is not thread-for-thread reproduction
(the generator repaints, it does not copy — established repeatedly in
`IMAGE_RND_LOG.md`); the bar is truthfully communicating the *type* of
craftsmanship, its depth/relief, its stitching character, and its handcrafted
appearance.

### The originating benchmark (manual detail-notes experiment)

Tested on the resolution benchmark (`/admin/benchmark`, resolution mode) with
a lavender chikankari kurta whose 2K/4K generations had rendered the
embroidery as a soft flat print:

1. **Baseline**: pipeline received only the product image (+ the standard
   category/color prompt). Result: correct macro pattern, but the stitch work
   read as printed, not dimensional.
2. **Enriched**: a human-quality description (written by Claude from the
   product photo + a zoomed crop of the embroidery — stitch types, motif
   geometry, density, relief, thread colours, handcrafted irregularity) was
   injected through the existing `detailNotes` prompt channel. Result:
   **significant improvement** — generated embroidery visibly closer to the
   real craftsmanship.

**Key interpretation.** The improvement did not come from a longer prompt; it
came from information that previously did not exist anywhere in the request.
The generator was always *capable* of rendering raised stitched work — it was
never *told* the work was raised and stitched. This is a **garment
understanding** gap, not a prompt engineering gap.

**Why this can't stay manual.** No retailer can be asked to write "double
rows of separated 2–3mm running stitches with phanda knot-flower centers,
raised relief casting fine shadows." The description step must be automated
from the uploaded image alone.

---

## 2026-07-13 — Architecture

### Pipeline position

```
Product Image
   ↓
Metadata Extraction        (lib/metadata/analyze.ts — "what IS this product?")
   ↓
Garment Intelligence       (lib/garment-intelligence — "what makes it UNIQUE?")  ← NEW
   ↓
Prompt Builder             (lib/model-gen/prompt-sets.ts — unchanged)
   ↓
Gemini Image Generation    (lib/generate-model-image.ts — unchanged)
```

Metadata Extraction and Garment Intelligence stay **separate services**:
different questions, different consumers, different cost profiles, different
cache lifetimes. GI does not replace `lib/metadata/detail-notes.ts` (v1
one-line enrichment); v1 remains the fallback whenever GI is disabled or
fails, so the flag can never make generation worse than today.

### Structured intelligence over prose — decision: YES

The service produces a **typed structure** (`lib/garment-intelligence/types.ts`):

```
GarmentIntelligence {
  construction      { silhouette, neckline, sleeves, details[] }
  surfaceTechniques [{ type, relief, density, handcrafted, colors[], placement, stitchCharacteristics }]
  pattern           { motifs[], layout, scale }
  texture           { baseFabric, finish, drape }
  craftsmanship     { overallDensity, handcrafted, highlights[] }
  regions           [{ label, technique, relief, detail, motif }]   ← close-up pass
  confidence
}
```

and a separate **deterministic renderer** (`render.ts`) converts it into the
natural-language fragment the generator consumes. Rationale:

- **One extraction, many renderings.** The same structure can later power
  product descriptions, AI Design Highlights, search/filter facets,
  recommendations and analytics — each with its own renderer — without a new
  vision call per feature. Prose-only output would lock the analysis to the
  one consumer it was phrased for.
- **Auditability.** The exact prompt text fed to the generator is a pure
  function of the stored structure (cached as `promptNotes`), so quality
  regressions can be bisected: wrong analysis vs wrong rendering.
- **Provider portability.** A future Claude/other-vision extractor only has
  to hit the same JSON contract; every consumer is untouched.
- Values are deliberately loose strings, not enums — clamping vision output
  to enums at extraction time would discard exactly the nuance
  ("shadow-work bakhiya" → "embroidery") this feature exists to capture.
  Consumers needing enums normalize downstream.

### Hierarchical analysis — decision: YES, two passes, ≤2 AI calls

```
Whole garment (capped 1024px)
   ↓  pass 1: overview JSON + up to 4 regions of interest (normalized bboxes)
Crop each ROI locally (sharp) from the ORIGINAL full-res buffer, cap 768px
   ↓  pass 2: ONE batched call, all crops → per-region stitch-level observations
Merge → GarmentIntelligence
```

Why hierarchical instead of whole-image-only: the generation input cap
(800px) and any whole-image downscale destroy stitch-level pixels — but a
**crop of the original** retains native pixel density exactly where the
craftsmanship lives. This mirrors how a merchandiser studies a garment:
overall read first, then close inspection of the work. Implementation notes:

- ROI boxes are model-proposed in pass 1, clamped/validated locally
  (degenerate slivers rejected), cropped with `sharp.extract` — **no second
  upload, no extra provider round-trip per region**: all crops ship in one
  request.
- Cost shape: plain garment (no ROIs) = 1 call; embellished = 2 calls. Never
  N calls for N regions.
- Pass-2 failure is non-fatal (keeps pass-1 result); pass-1 failure returns
  null (caller falls back to detail-notes v1).

### Caching / cost philosophy — extract once, reuse everywhere

- New table `garment_intelligence` (one row per product, cascade delete):
  full structure as JSON string (`data`), rendered `promptNotes`, `model`,
  `version`, and `analyzedImageUrl` — the row is valid only while the
  product's image matches; changing the image invalidates and re-analyzes.
- `ensureGarmentIntelligence(productId)` (`service.ts`) is the single entry
  point: cache-hit → zero AI calls; miss/stale → one analysis → upsert.
  Regenerations, view sets, and every future consumer reuse the same row.
- Analysis runs **lazily at first generation** (same pattern as detail-notes
  v1), not at upload: products that never generate images never pay for
  analysis. Moving it to upload time (so results are ready before the first
  generation) is a roadmap option, not a correctness change.
- Usage ledger: every call recorded in `ai_usage_events` under feature
  `garment_intelligence` (operations `overview` / `regions`), so real cost
  per product is measurable from day one.

### Model choice

`gemini-2.5-flash` by default (env-overridable via
`GARMENT_INTELLIGENCE_MODEL`). Deliberately a step above the
`gemini-2.5-flash-lite` used for metadata/detail-notes v1: judging *physical
relief from a photo* (raised stitch vs printed pattern) is the hard part of
this task and the cheapest tier is the wrong place to economize — while the
cache guarantees the cost is one-time per product. Unvalidated assumption to
benchmark: whether flash-lite would suffice for pass 1 (overview) with flash
reserved for pass 2 (stitch-level).

### Integration (deliverable 5)

`lib/model-gen/engine.ts`: when `ENABLE_GARMENT_INTELLIGENCE=true`, the
rendered `promptNotes` flow through the **existing `detailNotes` channel**
into `buildViewPrompt` — strategies, prompt-sets, and the generator are
completely untouched. Renderer priority mirrors the R&D finding (surface
work first): techniques → close-up region evidence → the "dimensional
handcrafted, not printed" contract sentence → pattern → highlights → texture
→ construction, capped ~900 chars.

### R&D inspection endpoint + UI

`/api/admin/garment-intelligence/[productId]` (admin-gated, unlinked):
- `GET` — cached row, never triggers an AI call.
- `POST` — deliberately runs/refreshes the analysis (a paid call) and
  returns the full structure + rendered notes, so extraction quality can be
  inspected **without paying for an image generation**.

**Inspection UI: `/admin/garment-intelligence`** (admin-gated, not linked in
navigation — same convention as `/admin/benchmark`). Two ways to test:
- **Catalogue products grid** — click any product: cached results open free
  ("Analyzed — view (free)"); unanalyzed ones run the paid analysis once.
  A "Re-analyze (paid)" action forces a refresh.
- **Ad-hoc photo upload** — analyze any garment photo + category WITHOUT
  creating a product (nothing persisted; backed by
  `POST /api/admin/garment-intelligence`), for testing new clothing before
  it enters the catalogue.
The result panel shows the rendered **prompt notes** (the exact text
generation receives) first, then surface techniques, close-up region
observations, pattern/texture/construction/craftsmanship and confidence.

---

## 2026-07-13 — Claude Vision discussion (architecture only, per brief)

**Feasibility.** Straightforward. The service's JSON contract is
provider-neutral; a Claude extractor is an alternate implementation of
`analyzeGarment` behind the same types. Claude's vision API accepts
multi-image requests, so the same two-pass, batched-crops design ports 1:1.
The structured-output discipline (defensive parse + normalization) already
built for Gemini applies unchanged.

**Would Claude provide a measurable advantage?** Plausibly yes, specifically
here. The originating benchmark's "good" description — the one that produced
the significant improvement — was written by Claude from the same images, so
there is direct (n=1, anecdotal) evidence Claude can produce the level of
stitch-physical description this feature needs. Claude models are generally
strong at *disciplined, instruction-dense descriptive analysis* — the
"describe only what is physically visible, distinguish relief from print,
be concrete about stitch character" style this prompt demands. Whether that
advantage survives (a) Gemini getting the same carefully engineered prompt,
and (b) the quality bar being "good enough to steer generation" rather than
"best possible prose", is exactly what a benchmark must establish. It is
entirely possible Gemini Vision clears the bar and the delta doesn't justify
a second provider.

**Architectural implications** (if/when adopted):
- Provider abstraction at the `analyzeGarment` seam only — service, cache,
  renderer, consumers unchanged. Mirrors the try-on provider pattern already
  in the codebase; do NOT abstract earlier than needed (this repo's explicit
  engine philosophy).
- **Orchestration/failure**: primary→fallback chain (e.g. Claude primary,
  Gemini fallback, v1 detail-notes last) keeps the non-fatal contract; no
  fan-out/consensus — doubles cost for marginal gain.
- **Latency**: GI is off the retailer's critical path (lazy, cached,
  generation-time); +1–3s from a second provider is invisible. Only an
  upload-time synchronous design would make latency matter.
- **Caching**: unchanged — the cache is keyed by product+image, storing
  `model` per row already supports mixed-provider fleets and A/B cohorts.
- **Cost**: cross-provider price comparison needed at decision time (pricing
  moves too fast to hardcode a conclusion here); the one-time-per-product
  cache makes even a pricier extractor viable, since extraction cost
  amortizes over every future reuse.
- **Maintainability**: second SDK/auth path, second prompt to keep in sync,
  second failure mode — real ongoing cost. Only worth it for a demonstrated,
  meaningful quality delta.

**Recommended benchmarking methodology** (before any second provider ships):
1. Fixed corpus: 15–25 real products across surface techniques (chikankari,
   zari, mirror, sequin, bead, lace, plain prints as controls) and
   categories.
2. Both providers extract with the **same prompt contract** → same JSON.
3. Score two things independently:
   a. **Extraction accuracy** — human (retailer/merchandiser) grades each
      structure against the physical garment: technique named correctly?
      relief correct? density correct? hallucinated attributes?
   b. **Downstream effect** — generate with each provider's rendered notes
      (same seed conditions/product/backdrop), human side-by-side zoom
      comparison against the real photo, same protocol as the resolution
      benchmark. (The AI-reviewer scorer has a documented blind spot for
      structural pattern drift — IMAGE_RND_LOG 2026-07-03 — so human
      evaluation stays the headline metric.)
4. Track per-extraction cost + latency from `ai_usage_events`.
5. Decision rule: a second provider ships only on a clear extraction-accuracy
   win **that survives into the generated image** — a better description
   that doesn't change the render is not worth a second SDK.

---

## Limitations (current prototype)

- **Prompt-level lever only.** GI tells the generator what the work IS; the
  generator still repaints. Perfect thread-for-thread fidelity is out of
  scope by design; pixel-reinjection approaches live in the separate refine
  R&D track (`IMAGE_RND_LOG.md`).
- **ROI quality is model-dependent.** Bad boxes → weak pass 2. Boxes are
  clamped but not verified; a future heuristic (edge-density scan) could
  cross-check them for free.
- **Front/main image only.** Back images still use detail-notes v1; part
  close-ups (the retailer's own macro shots) aren't yet fed into pass 2 —
  both are natural extensions.
- **Unvalidated at scale.** Concept validated by one manual benchmark
  (n=1 product). The prototype exists precisely to run the broader corpus.
- **No retailer visibility/editing** of extracted intelligence yet.

## Future possibilities (roadmap ideas — NOT implemented)

- Automatic product descriptions rendered from the same structure.
- AI Design Highlights (retailer-facing "craftsmanship callouts").
- Recommendation engine features (technique/texture compatibility).
- Search indexing + faceted filtering on techniques/motifs/relief.
- Quality scoring & craftsmanship verification (claimed vs detected).
- Retailer review/editing UI for extracted intelligence (turns extraction
  errors into training signal).
- Confidence scoring per attribute (currently one global confidence).
- Upload-time (eager) extraction option.
- Feeding retailer part close-ups into pass 2 as additional evidence.
- Provider benchmarking per the methodology above; multi-provider
  orchestration if justified.
- Human review workflow for low-confidence extractions.

## Status

- **Implemented (this branch)**: schema + migration, hierarchical Gemini
  Vision analyzer, deterministic renderer, cached service, engine wiring
  (flag-gated), admin inspection endpoint, this document.
- **Not yet run**: any paid extraction call. First validation step: pick the
  chikankari kurta product, `POST /api/admin/garment-intelligence/<id>`,
  inspect the structure + rendered notes against the manual description that
  worked, then A/B a generation with the flag on vs off.
