# AI Cost Optimization Audit

Date: 2026-07-04
Scope: Gemini/Vertex image generation pipeline (catalogue generation, quick listing,
try-on, Fabric Flow). Strictly a cost/efficiency audit — no prompt rewrites, no
model/provider changes, no quality or UI changes. See individual findings for the
reasoning behind each classification.

Two categories, per the audit brief:

- **Safe** — no possibility of changing generated output; implemented directly.
- **Experimental** — plausible savings, but touches something that could change
  generation/scoring behavior; documented only, not implemented.

---

## Safe Optimizations (implemented)

### 1. Reference-model images were sent to Gemini unpreprocessed

`lib/generate-model-image.ts` → `runGeminiImageGen`

Every catalogue/quick-listing generation call that uses a reference model attaches
a second image — the curated "studio person" photo from `public/reference-models/`.
The product image already goes through a deliberate downscale
(`lib/images/preprocess.ts` `preprocessProductImage`: Lanczos3 → max 1024px →
sharpen → WebP q90), justified by the existing code comment: *"bigger wastes input
tokens for diminishing understanding; the model caps its own internal resolution."*
The reference image was exempt from this and sent at its raw stored size.

Measured against the actual assets in `public/reference-models/`:

| Asset | Before | After |
|---|---|---|
| woman-*-front/back (used most) | 968×1625, ~1.6–2.0MB PNG | 610×1024, ~30–80KB WebP |
| girl-kurti / girl-lehenga | 1697–1698×927, ~1.5–1.7MB PNG | 1024×559, ~24–39KB WebP |
| boy-basic / girl-basic | 1408×768, ~450–520KB JPG | 1024×559, ~22–24KB WebP |
| man-basic | 1023×1537, ~1.6MB PNG | 682×1024, ~40KB WebP |

Average ~97% smaller encoded payload across all 13 assets; the pixel dimensions
themselves also shrink (e.g. 968×1625 → 610×1024, ~60% fewer pixels) for the most
frequently used set, which is what actually reduces Gemini's image-tile token count
— the byte-size drop alone is mostly a (welcome) side effect of PNG → WebP.

**Why this is safe:** identical technique already validated in production for the
product image, applied symmetrically to the other image in the same request. Gemini
never sees the removed pixels either way, since it downsamples internally beyond
this point regardless.

**Change:** `lib/generate-model-image.ts` — `referenceBuffer` now passes through
`preprocessProductImage` before being base64-encoded into the request, same as the
product buffer. Usage-ledger records (`recordAiUsage`) now log the actual
(preprocessed) reference size instead of the raw one, so `ai_usage_events` reflects
real bytes sent.

### 2. Fashion Designer's flat-image construction fetched every reference image twice

`lib/fashion-designer/agents/garmentConstructionAgent.ts`

`garmentConstructionAgent` generates the front and back flat-lay images via two
parallel calls (`generateFlatImage`), and each call independently re-fetched and
re-base64-encoded the same up-to-4 reference URLs (fabric/sketch/reference/detail
images) from Cloudinary. Refactored to fetch once and reuse the encoded parts for
both calls.

**Why this is safe:** byte-for-byte identical images are sent to Gemini either way;
this only removes a redundant Cloudinary fetch + base64 encode on our own server.
Does not change Gemini's per-request image-token billing (each request still gets
the same images), but removes duplicate egress bandwidth and CPU work.

---

## Experimental Optimizations (documented, NOT implemented)

### A. AI Review QA sends full-resolution images to the scoring model

`lib/model-gen/ai-review.ts` `fetchImageBase64` fetches both the generated output
and the original product image at full delivery resolution before scoring them
against a 1–5 rubric (feature-flagged off by default via `ENABLE_AI_REVIEW`).
Downsizing via a Cloudinary transform on the fetch URL would cut cost, but this is
a QA/scoring subsystem — sending a smaller image could plausibly shift
`patternPreservation` / `textureQuality` scores, which is a behavior change to the
scoring itself even though it never touches the customer-visible image. Left for a
deliberate follow-up with before/after score comparison, not bundled here.

### B. Virtual try-on never preprocesses the product image

`lib/tryon.ts` `generateTryOn` sends the raw fetched product buffer straight to
Gemini with no equivalent of `preprocessProductImage` — the same asymmetry as
Safe Optimization #1, but on the customer-facing try-on path rather than catalogue
generation. The technique would likely transfer directly, but try-on is outside
this audit's stated scope (catalogue generation) and sits closer to the
higher-stakes "preserve the person's face/skin tone exactly" requirement — worth
its own scoped pass rather than folding into this one silently.

### C. Batching Fabric Flow's per-accessory analysis calls

`lib/fashion-designer/agents/accessoryUnderstandingAgent.ts` calls Gemini once
**per accessory image** (`Promise.allSettled` over each asset) rather than one
batched call analyzing all accessories together. Batching would cut the fixed
per-request prompt/model overhead, but changes the model's reasoning context —
analyzing accessories together vs. in isolation could cross-contaminate results
(e.g. placement suggestions referencing the wrong accessory). A genuine behavior
change, not a pure encoding trim.

### D. Prompt wording overlap between the reference-branch instruction and detailNotes

`lib/model-gen/prompt-sets.ts` `buildViewPrompt` — when a reference model is used,
the fixed instruction already says "preserve the garment's exact colour, print and
texture," and the separately-appended `detailNotes` clause (AI-extracted per
product) can restate similar ideas in different words. No case of byte-for-byte
duplicate information was found — the overlap that exists is additive detail
(motif, embellishment, weave) layered on top of the generic instruction, not pure
repetition — so trimming it would be a wording experiment with unclear payoff, not
a safe removal.

---

## Already efficient (no action needed)

- `lib/model-gen/studio-anchor.ts` — samples backdrop colour via a Cloudinary
  crop-to-1×1/16×16 transform fetched over HTTP; already the smallest possible
  payload for that purpose.
- `lib/model-gen/backdrops.ts` — backdrop presets are structured metadata rendered
  once into a prompt fragment; no AI call, no duplication.
- `lib/images/preprocess.ts` — the product-image preprocessing this audit's Safe
  Optimization #1 extends to reference images was already well-tuned (1024px cap,
  Lanczos3, WebP q90).
