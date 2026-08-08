# Session handoff — saree craftsmanship fidelity (2026-08-08)

For a new session picking this up. Read this first, then
`docs/research/SAREE_ANATOMY_TAXONOMY.md` (the full 10-sample teaching log
this is derived from) before touching code.

## What this work is for

Product Match generates AI catalogue photos of Indian ethnic wear —
retailers upload a product photo, the app dresses a model in it. The
retailer's standing complaint, going back months: generated craftsmanship
(embroidery, zari, mirror work, texture) reads as flat/printed once you
zoom in, especially on sarees. This session's premise: the app's
understanding of saree anatomy (border/pallu/buti relationships,
orientation, craftsmanship type) is only as good as what Claude/Gemini
actually know about the category, and that had never been deliberately
taught. The retailer walked through 10 real sample sarees, least to most
complex, explaining terminology, orientation rules, and failure modes in
detail — that teaching log became the taxonomy doc, which became concrete
schema and prompt changes.

**Retailer's own framing, worth holding onto:** a fix only counts once it's
a taxonomy entry, a schema field, or a deterministic prompt clause that
every future product runs through — not something tailored to one sample's
photo. The recurring failure mode this project has hit before (and this
session re-diagnosed) is fixes that work on the benchmark product and don't
generalize.

## What's shipped (this branch: `feature/image-gen-model-selector`)

1. **GarmentIntelligence schema v3** (`lib/garment-intelligence/types.ts`) —
   saree/dupatta structure (borders with independent top/bottom, pallu
   relationship, multiple buti populations with placement+axis), plus
   garment-agnostic additions that apply to every category: construction
   method (woven-in vs. applied-on — drives whether flat is authentic or a
   fidelity loss), physically-layered relief, explicit absence facts,
   self-tone capture-risk.
2. **Saree-conditional extraction prompt** (`analyze.ts`) — encodes the
   verified geometric border/pallu rule and asks for multiple buti
   populations explicitly, rather than leaving Gemini to infer them.
3. **Phase 3 region-conditioning** (`region-references.ts`, new) — threads
   GI's own evidence (retailer uploads + model-proposed ROI crops) into
   generation-time image conditioning, each paired with a placement
   sentence sourced from structured data. Flag-gated
   (`ENABLE_GI_REGION_REFERENCES`, off by default).
4. **Live-tested** on 3 real products (not just taxonomy samples) — Sample
   7, 9, 10. Full findings in the taxonomy doc's sample log and "Phase 3 —
   implemented" section. Headline results:
   - Text-side (GI extraction) structural reads (color zones, border
     sub-bands, hard-split detection) are solid; population-counting and
     precise zone attribution are still the weak point — under-counts
     (misses a second buti population) or over-attributes (bleed-through
     misread as real content).
   - Image-side (Phase 3 conditioning) did NOT reliably fix the
     confinement problem it targeted — in one test it made coverage read
     as *more* spread out, not less. Model-specific: nano-banana-pro
     leaked a confined motif onto the pallu in both GI-source conditions
     tested; nano-banana-2 improved on a re-run.
   - Real pricing bug found and fixed along the way: nano-banana-2's
     output rate was half Google's real rate; corrected against an actual
     GCP invoice.
5. **Upload page redesign** (`app/(dashboard)/upload/page.tsx`) —
   responsive two-column layout, nested per-part macro uploads (replacing
   flat generic "Detail Close-up" slots — retailer's own act of uploading
   under a named part is ground truth for which zone a macro belongs to,
   not an inference GI has to make), consistent segmented-toggle pattern,
   retailer-facing model naming ("Balanced"/"Fine Detail", not provider
   codenames) gated behind `ENABLE_IMAGE_GEN_MODEL_CHOOSER` (off by
   default).

All committed (3 commits on this branch, not yet pushed/merged — see
`git log` for exact messages). `tsc`/lint clean throughout. **Not yet
verified in an actual browser session** — Chrome extension wasn't
connected when this was built; only `tsc`, lint, and a non-auth curl
check confirmed the route doesn't 500.

## What's next (retailer's stated priorities, in order raised)

1. **Review the retailer's own manual testing findings** — they've been
   using the app hands-on since these changes landed and will bring bugs/
   issues found through real use. Treat these as real signal, not just
   more taxonomy samples — but hold the same generalization bar: a fix
   should extend the schema/prompt, not patch around one product.
2. **The "erase" feature — mask-based region editing.** Explicitly scoped,
   not yet designed in detail or built. Motivation: even with everything
   above, generation still gets isolated regions wrong (the Phase 3 test's
   buti-placement miss is the concrete case that motivated this). Rather
   than re-rolling a whole regeneration and risking a new regression
   elsewhere, let the retailer circle the specific wrong region on an
   already-generated image, supply a correction (text and/or a real
   reference photo — could reuse the part-slot uploads already in place),
   and regenerate only that masked region. **Confirmed technically real**:
   Gemini supports genuine mask-based inpainting (black/white mask image,
   region outside the mask stays untouched) — this isn't a workaround,
   it's a purpose-built capability. Needs: a mask-drawing UI (new
   interaction pattern for this app), a new backend edit action, and a
   decision on how edited images persist given the existing
   delete-and-recreate model for `ProductImage` rows (see
   `lib/model-gen/persist.ts` — regeneration currently replaces, doesn't
   version).

## Open items not yet resolved

- Browser verification of the upload page redesign never happened —
  do that first if picking up the UI thread.
- Whether the newly-verified pricing (nano-banana-2 = $60/M,
  nano-banana-pro ≈ $100/M approximated) needs further refinement —
  nano-banana-pro's real billing is closer to flat-per-image-by-resolution
  than a token rate; current fix is an approximation.
- Whether generic (non-saree) categories benefit from the v3 schema's
  garment-agnostic fields — architecturally they should, never actually
  tested on a non-saree product.
- `ENABLE_GARMENT_INTELLIGENCE`, `ENABLE_REGION_CONDITIONING`,
  `ENABLE_GI_REGION_REFERENCES`, `ENABLE_IMAGE_GEN_MODEL_CHOOSER` are all
  `true` in local `.env` for continued testing; all default `false` in
  production/Railway until deliberately flipped.

## Where the detail actually lives

- `docs/research/SAREE_ANATOMY_TAXONOMY.md` — the full teaching log,
  sample-by-sample, with every taxonomy finding and its code mapping.
- `docs/research/GARMENT_INTELLIGENCE_RND.md` — the pipeline's earlier
  history and design philosophy (structured-over-prose rationale, why
  hierarchical two-pass analysis, etc.) — this session's schema v3 builds
  directly on decisions made there.
- Git log on `feature/image-gen-model-selector` for the exact diffs.
