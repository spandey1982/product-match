# Image AI — R&D Experiment Log

Dedicated log for **research/benchmark** work on the image-generation pipeline —
questions we tested, what we found, and whether it changed production. This is
separate from [`docs/IMAGE_AI_ROADMAP.md`](../IMAGE_AI_ROADMAP.md), which stays
the architecture/decision source of truth for what's actually **shipped**. Log
here first; only promote a finding into the roadmap once it becomes a real
production decision.

All work referenced here happens on the local-only branch
`rnd/image-pipeline-benchmarks` (renamed from `feature/hq-image-pipeline`) via
`/admin/benchmark` (internal, `isAdmin`-gated, not linked in navigation).
Never pushed — see the branch's own commit history for the code.

---

## 2026-07-03 — Native Gemini output resolution (1K vs 2K vs 4K)

**Objective.** Gemini image generation (`gemini-3.1-flash-image`) was found to
omit `generationConfig.imageConfig.imageSize`, which per Google's docs defaults
to 1K. Determine whether requesting 2K or 4K natively produces meaningfully
better catalogue images, independent of AI upscaling, and whether the extra
cost is justified.

**Hypothesis.** Uncertain going in — plausible that more output pixels let the
model render finer fabric/embroidery detail; equally plausible (per the
existing Vision Pipeline v2 finding — see `docs/IMAGE_AI_ROADMAP.md`'s
super-resolution section — that Gemini *repaints* rather than *copies*
pixels) that resolution has no effect on fidelity, since the model's internal
understanding of the product doesn't change with output canvas size.

**Test setup.**
- New benchmark mode `resolution` (`lib/benchmark/resolution-run.ts`), reusing
  the existing `/admin/benchmark` infra (`lib/benchmark/base.ts`,
  `generateBaseShot`) so prompt/reference/provider/category/color/gender are
  held byte-for-byte identical across the three generations — only
  `imageConfig.imageSize` varies.
- Added `imageSize?: "1K"|"2K"|"4K"` to `runGeminiImageGen`
  (`lib/generate-model-image.ts`) — purely additive, no production caller sets
  it, so this ships no behavior change to `main`.
- 6 cards per run: `native-1k/2k/4k` (Gemini) × native + `+Real-ESRGAN` upscale
  of each. Captures dimensions, file size, generation latency, output tokens,
  estimated cost (`lib/ai-usage/pricing.ts`), and an AI-reviewer quality score
  (texture/pattern/sharpness/product/realism + free-text issues) per card.
- **Provider probe first** (before building anything): confirmed directly
  against the Gemini API that `gemini-3.1-flash-image` (the non-preview model
  this codebase targets) *does* honor `imageConfig.imageSize` — 1K → 1408×768,
  2K → 2816×1536, 4K → 5632×3072 on a throwaway prompt. The known bug where the
  `-preview` variant ignores this parameter does **not** reproduce here.
- **Run 1** used a seeded demo product whose source image turned out to be a
  360×360 thumbnail (degenerate — smaller than the pipeline's own 800px input
  cap, so it couldn't carry real fine detail regardless of output size).
  Discarded as a source-quality confound, not used for conclusions.
- **Run 2** (primary evidence) used a real catalogue photo, "Emerald Green
  Silk Saree with Red and Gold Border" — 853×1280 source, resized to 533×800
  by the existing Lanczos input-cap step, generated at 1K/2K/4K.
- Real-ESRGAN cards (`+Real-ESRGAN`) could **not** run locally — this dev
  environment has `REPLICATE_API_TOKEN=""` and `ENABLE_BENCHMARK_UPSCALERS=false`
  in `.env` (keys present, values not configured). All three upscale cards
  recorded "unavailable" — the existing graceful-degradation path, same as
  upscaler-mode runs. **Open item, not a bug**: needs a real Replicate token to
  complete that half of the comparison.

**Observations (Run 2, per-card facts).**

| Tier | Output px | File | Gen time | Output tokens | Est. cost | AI quality | AI-flagged issues |
|---|---|---|---|---|---|---|---|
| 1K (current default) | 800×1343 | 632 KB | 15.9s | 1,454 | $0.0438 | **4/5** | "slight loss of texture detail on the green fabric when zoomed" |
| 2K | 1600×2686 | 2.31 MB | 22.6s | 1,983 | $0.0597 | 3/5 | "slightly blurred border pattern on zoom", "fabric texture appears slightly plasticky on zoom" |
| 4K | 3200×5372 | 7.85 MB | 29.8s | 2,817 | $0.0847 | 3/5 | "plasticky silk", "smeared zari border", "blurred pallu motif" |

Dimensions scaled exactly 2× per axis per tier (4× pixels), as documented.
Cost and tokens scaled far more gently — 4K costs **~1.9×** 1K, not 16×,
because Gemini's image-gen billing is output-token-based, not pixel-count-based.

**The decisive finding came from visual inspection, not the AI-reviewer
score.** Downloaded and eyeballed all three generated images side by side
against the real product photo:
- **1K** faithfully reproduced the source's actual border — a simple
  red-and-gold zigzag/stripe pattern.
- **2K** kept the same border motif with minor softening.
- **4K** **fabricated a completely different border design** — an ornate
  "temple gopuram" architectural motif that does not exist on the real
  product at all. The AI reviewer's automated score for 4K (3/5, "smeared zari
  border") did **not** catch this as a structural/pattern error, only a
  vague sharpness complaint — a real blind spot in the automated scorer that
  the human zoom-and-compare step caught immediately.

This directly confirms, from a completely different angle, the existing
"model repaints rather than copies" finding from the upscaler/refine R&D: a
bigger output canvas gives the model more room to *invent* plausible-looking
detail, not more accuracy to the real product. In this sample, going from 1K
to 4K made fidelity measurably **worse**, not better.

**Metrics.** See table above. Real-ESRGAN cost/latency for the upscale
comparison is unmeasured pending a Replicate token (see Open item).
Total spend for both runs (6 Gemini generations + reviewer scoring): **~$0.37**.

**Conclusion.** On this sample, higher native `imageConfig.imageSize` did not
improve catalogue image quality — it increased the risk of the model
hallucinating incorrect product detail (wrong border pattern), while costing
~1.4–1.9× more output tokens and taking ~1.4–1.9× longer per generation. n=1
run of 3 tiers on one product is not enough to generalize a permanent decision
from, but it's a strong enough signal to deprioritize this lever.

**Final decision.** **Do not raise the production `imageConfig.imageSize`
default from 1K.** No production code path was changed — `runGeminiImageGen`'s
`imageSize` parameter is optional and unused by any live caller. Revisit only
if a future need (e.g. print-quality export) specifically requires bigger raw
pixels and can tolerate the accuracy risk, or after running a few more
categories/products through this same benchmark to confirm the pattern holds.

**Follow-up actions.**
1. Configure a real `REPLICATE_API_TOKEN` (with `ENABLE_BENCHMARK_UPSCALERS=true`)
   to complete the 3 missing `+Real-ESRGAN` cards — tests whether upscaling a
   1K generation gets closer to "4K quality" for less risk/cost than
   generating natively at 4K.
   - **Note:** at true 4K (5632×3072-class) input, a 4× Real-ESRGAN pass would
     target ~22,528×12,288px (~277MP) — likely far beyond what the Replicate
     `nightmareai/real-esrgan` endpoint accepts/completes in reasonable time.
     Expect the 4K+upscale card to need a smaller upscale factor or to fail;
     that's itself useful evidence, not a bug to "fix."
2. Re-run on 2–3 more categories (e.g. a printed/patterned fabric and a heavy
   embroidery lehenga) before treating "don't raise resolution" as a durable
   platform decision — one saree sample is suggestive, not conclusive.
3. If cost/quality tradeoffs become relevant later, the AI-reviewer's blind
   spot for structural pattern drift (finding #1 above) is worth fixing
   independently of this experiment — it's currently under-weighting the
   single most visible failure mode.

---

## 2026-07-03 — Implementation note: Native 2K exposed as an opt-in "Enhanced" quality

Following further evaluation, a native **2K** option has been incorporated into
the live application as a retailer-facing, per-generation choice — not a
change to the default. This is deliberately scoped narrower than "raise the
resolution": **Standard (1K, 3:4)** stays the default for every generation,
exactly as this log's 2026-07-03 finding recommended; **Enhanced (2K, 3:4)**
is available for a retailer to opt into per product, per generation, with no
persistence (resets to Standard every time — see `lib/model-gen/quality.ts`).
4K and Real-ESRGAN upscaling were **not** carried into production — the
benchmark above found 4K actively hurts fidelity risk for cost, and the
Real-ESRGAN comparison remains incomplete (open item #1 above). Both stay
available for further R&D on `rnd/image-pipeline-benchmarks` if revisited.

Implementation: `lib/model-gen/quality.ts` (new — the quality-id → `imageSize`
+ `aspectRatio` mapping), threaded through `runGeminiImageGen`
(`lib/generate-model-image.ts`) and both model-gen strategies
(`lib/model-gen/strategies/{catalogue,quick-listing}.ts`) down from a
temporary selector on the Add Product page. Both quality tiers now request
`imageConfig` explicitly (aspect ratio was previously left to Gemini's
per-prompt judgment for every generation, not just this feature) — see branch
`feature/generation-quality-option` for the full change, PR pending.

Incidentally found and fixed while touching this code path: two call sites
(`lib/generate-model-image.ts`'s legacy `generateModelImage`, and
`lib/model-gen/persist.ts`) still used a raw `UPDATE ... datetime('now')`
query — SQLite syntax left over from before the Postgres migration, invalid
on Postgres (`function datetime(unknown) does not exist`). Confirmed via a
live 500 during testing; both now use a typed `db.product.update`. This means
the objective-based catalogue/quick-listing generation flow was silently
failing to persist `Product.modelImageUrl` on `main` before this fix.

The long-term quality-tier strategy (entitlements, pricing, persistence,
admin controls, automatic recommendations) remains explicitly under
evaluation and was **not** implemented here — see "Future Direction" in the
originating task. This entry is a pointer for when that design work resumes.

---

## 2026-07-03 — Production testing findings: floating-swatch hallucination + stale merge

Retailer testing of the Enhanced (2K) quality option surfaced a new defect and
an unrelated but significant process gap.

**Finding 1 — spontaneous "fabric swatch" inset.** A real 2K back-view
generation ("Lavender Floral Embroidered Saree") included a circular floating
fabric-detail swatch next to the model, disconnected from the garment —
matching no element of the retailer's actual uploaded source photo. Verified
generated (not a Cloudinary compositing artifact) by re-fetching the raw
stored master with the branding transform stripped from the URL — the swatch
persisted. Verified not copied from the input — the retailer's real source
photo (a flat-lay tailor's-table shot) has no such inset. Compared against two
back-view generations that pre-date the explicit-`imageConfig` change (2026-06-27,
implicit aspect ratio) — neither has this artifact.

Root cause: the studio prompt (`lib/model-gen/backdrops.ts`) forbade text and
watermarks but never forbade secondary insets/collage elements. Forcing every
generation onto a fixed, fairly open 3:4 canvas (this task's own change)
apparently gives the model room to add a compositional convention it's seen
heavily in Indian-ethnic-wear e-commerce training data — a small circular
fabric-detail callout beside the main shot. This is the same underlying
failure mode as the 4K border hallucination in the first entry above: extra
canvas room → invented plausible-but-wrong content, not improved fidelity.
Affects **both** Standard and Enhanced (both now request explicit 3:4), not
Enhanced alone.

**Fix:** extended the existing negative-constraint sentence in
`renderBackdropPrompt` to *"...no secondary insets or fabric swatches — exactly
one continuous photograph."* Verified by regenerating the exact same product/view
that produced the original artifact — swatch is gone, clean single-subject shot.

**Finding 2 — Backdrop Intelligence (R1–R3) was built but never merged to
main.** While investigating the swatch, a retailer report of branding being
truncated on close-up crops (and not adapting to image content) led to
discovering that `feature/backdrop-intelligence` — a complete, phase-tracked
"done" branch (crop-order branding fix, coverage-aware placement via
`studio-anchor.ts`, the whole backdrop system) — branched directly off `main`'s
tip and was never merged. `main` was still running the old branding code:
overlay applied before crop (truncating close-up watermarks) and a static
configured corner with no content-aware color/opacity adaptation. Merged
`feature/backdrop-intelligence` into `main` (clean fast-forward, 17 commits, no
schema changes) and rebased `feature/generation-quality-option` on top
(5 conflicts, all "two branches added a different param to the same
function" — mechanical to resolve). Verified live: close-up branding now
renders fully uncropped, and mark color/corner genuinely vary per card.

**Bonus:** the same merge incidentally fixed a third defect the retailer
reported — a thin white line on either side of the hero product image (CSS
`aspect-[3/4]` container vs. the model's actual ~0.7467 output ratio,
letterboxed by `object-contain`). The merged `ProductDetailView.tsx` already
routes front/back/on-model views through `normalizeCatalogueUrl`
(`c_pad,ar_3:4,...`) before display, which mathematically pads to exact 3:4.
Verified: 1200×1600, ratio exactly 0.7500. No separate fix needed.

**Process takeaway:** this is the second and third time in one day a
completed, working fix was found sitting on an unmerged branch while `main`
ran the broken version (the first was the `datetime('now')` Postgres bug,
independently fixed on two different branches before either reached main).
Worth checking for other stranded branches before assuming a reported defect
needs new code.

---

## 2026-07-04 — Investigation: storage/delivery efficiency after the 2K quality change

**Objective.** Enhanced (2K) generation confirmed better fabric/embroidery
detail, but the raw files are much larger. Investigate whether storage/delivery
can be made more efficient **without reducing what Gemini generates** — the
retailer's explicit constraint was "optimize after generation, never generate
less to save space." Investigation only; no code changed.

**Method — no new paid provider calls.** Every number below comes from either
(a) the existing `ai_usage_events` ledger (40 real past generations already on
disk from prior sessions), or (b) free local re-encoding of real, already-downloaded
generated JPEGs via `sharp` — no new Gemini/Vertex/Replicate calls were made.

**Q1 — output format.** Always `image/jpeg`. Confirmed across all 40 logged
`gemini-3.1-flash-image` generations (1K/2K/4K, multiple categories) — 100%
JPEG, no PNG/WebP ever observed.

**Q2 — real file sizes** (averaged from the ledger):

| Tier | Pixels | Avg size (n) |
|---|---|---|
| 1K | ~800×1343 | ~620 KB (n≈17) |
| 2K | ~1600×2686 | ~2.3 MB (n≈8) |
| 4K | ~3200×5372 | ~7.7 MB (n≈5) |

**Q3 — what's actually uploaded to Cloudinary.** Traced `runGeminiImageGen`
(`lib/generate-model-image.ts`): the raw `inlineData` bytes Gemini returns are
base64-decoded and uploaded via `cloudinary.uploader.upload(dataUri, {...})`
**completely unmodified** — no resize, no re-encode, no quality/format
parameter. Confirmed the same is true at all 8 `cloudinary.uploader.upload`
call sites in the repo (catalogue/quick-listing, legacy, try-on ×2, fashion-designer
×2, auto-catalog, product/logo upload) — none pass `quality`, `format`, or
`eager`. `lib/cloudinary.ts` itself is bare SDK config, no upload preset.

**Q4 — is Cloudinary auto-optimizing?** Not automatically — but it's already
wired up **deliberately, at delivery time only**: `lib/images/variants.ts`
inserts `f_auto,q_auto` (+ a width cap) into three explicit derived URLs
(`master` w_2048, `display` w_1200, `thumbnail` w_400), applied at render in
`ProductDetailView`/`ProductCard`/`RecommendationCard`. Verified live: a
`display`-variant 2K image (1200×1600, `c_pad,ar_3:4` + `f_auto,q_auto,w_1200`)
delivered at **~147 KB** — Cloudinary's own optimization already works well
*when a variant URL is actually used*.

**Found one real gap:** `components/product/ShareModelImage.tsx` uses
`product.modelImageUrl` **directly**, bypassing all three variant helpers.
Every share and download transfers the full, unoptimized, un-capped stored
master (2.3–7.7 MB at Enhanced/4K) — the only place in the app that does.

**The actual finding — the stored master itself is needlessly large.**
Free local test: re-encoded three real generated images (1K/2K/4K) through
`sharp`'s mozjpeg encoder at quality 95 (i.e. *near-maximum*, deliberately
conservative) and it was consistently **~27–28% of Gemini's original file
size** — WebP/AVIF at even more conservative settings (q80/q70) landed at
5–13%. Cropped a detail-heavy embroidery region from the original vs. the
q90 mozjpeg re-encode and visually compared them side by side — indistinguishable.
This means Gemini's own JPEG encoder is not close to size-optimal for the
same visual quality; the bloat is encoding inefficiency, not real information
we'd be discarding by re-encoding.

| Re-encode | 1K (617KB orig) | 2K (2260KB orig) | 4K (7665KB orig) |
|---|---|---|---|
| JPEG q95 mozjpeg | 173KB (28%) | 618KB (27%) | 2111KB (28%) |
| JPEG q90 mozjpeg | 115KB (19%) | 375KB (17%) | 1324KB (17%) |
| WebP q80 | 50KB (8%) | 156KB (7%) | 488KB (6%) |
| AVIF q70 | 49KB (8%) | 141KB (6%) | 426KB (4%) |
| PNG (lossless) | 1579KB (256%) | 6284KB (278%) | 23309KB (304%) |

Lossless (PNG) roundtrip is 2.5–3× *larger* than Gemini's own JPEG — expected
(photographic content, not line art) and confirms lossless is the wrong target
for this content category entirely.

**Cloudinary cost model** (verified via Cloudinary's own pricing pages,
2026): a unified credit system — 1 credit = 1 GB storage **or** 1 GB
bandwidth **or** 1,000 transformations. Transformations are cheap per-unit
and CDN-cached after first render (an unchanged derived URL doesn't
re-transform on repeat views), so at Mentis's realistic scale transformation
volume is not a cost concern. **Opinion: bandwidth will become the dominant
cost as traffic grows** — it scales with page views/shares/downloads, not
catalog size, and it's the one dimension the `ShareModelImage` gap actively
makes worse today. Storage is a distant second, growing linearly with catalog
size × chosen quality tier; re-encoding the master addresses storage directly
and (for the one bypassed path) bandwidth too.

**Critique of the proposed pipeline** (Native Gen → Master → Store → Delivery
variants → Serve): directionally correct and already ~80% built — the
master/display/thumbnail hierarchy exists today. The one missing stage is a
**re-encode step between generation and upload**: Gemini's raw output should
be re-compressed (JPEG mozjpeg q90–92, matching the existing `preprocessProductImage`
convention of "controlled encode, not the provider's blind default") *before*
`cloudinary.uploader.upload`, so the stored master itself — not just its
derived delivery URLs — is efficient. This is strictly post-generation: same
pixels Gemini decided to draw, just encoded without the waste. Fully
consistent with the stated principle (never reduce generation quality to save
space) — this reduces bytes, not information content, and the visual A/B
above didn't find a perceptible difference at q90+.

**Modern formats (WebP/AVIF):** Cloudinary already supports both and already
negotiates per-browser automatically via the existing `f_auto` in every
delivery variant — no gap there. Recommend the **stored master stay JPEG**
(universal compatibility for a source-of-truth asset — other integrations,
tools, or future export paths won't all support AVIF), and continue leaving
WebP/AVIF entirely to Cloudinary's `f_auto` delivery-time negotiation rather
than picking one modern format to bake into storage.

**Lossless vs. visually lossless:** visually lossless (JPEG q90–92 mozjpeg,
or Cloudinary's own `q_auto`) for every category asked about — masters,
listings, zoom, thumbnails. AI-generated images are already a lossy
reinterpretation of the real product (per this log's earlier findings);
chasing pixel-perfect lossless storage protects information that was never
recorded exactly in the first place, at real cost (2.5–3× larger, confirmed
above).

**Zoom experience:** already solved. `ProductImageViewer` (the zoom modal) is
conditionally rendered — `{viewerIndex !== null && <ProductImageViewer images={masterImages} .../>}`
in `ProductDetailView.tsx` — so the `master` variant URLs are never fetched by
the browser until the user actually opens the zoom viewer. No new lazy-loading
mechanism needed; the existing React conditional-render pattern already
achieves it.

**Compression-quality methodology:** the visual A/B approach proposed (embroidery/
lace/jewellery/texture/face, inspect for the point where size drops sharply with
no visible loss) is the right methodology, and the table above is a first pass at
exactly that — but on 3 images from one product. Recommend a slightly broader
pass (5–8 real products across categories with heavy embroidery/zari/lace/
jewellery, since those are the highest-risk content for compression artifacts)
before locking an exact quality number — still zero Gemini spend, pure local
re-encoding of already-generated images.

**Recommendation.**
1. Add a `reencodeGeneratedImage` step in `runGeminiImageGen`, right after the
   Gemini response and before `cloudinary.uploader.upload` — re-encode via
   `sharp` JPEG mozjpeg at a quality settled by the broader A/B pass above
   (q90–92 is the strong prior from this first pass). Store the re-encoded
   buffer, not the raw Gemini bytes.
2. Fix `ShareModelImage.tsx` to route through `masterUrl()` instead of the bare
   `modelImageUrl` — closes the one bandwidth gap found.
3. Leave the delivery-variant system (`f_auto,q_auto` in `variants.ts`) exactly
   as-is — it already works and this doesn't change it.
4. No change to generation itself (resolution, `imageConfig`, prompts) — this
   whole plan operates strictly after Gemini's response.

**Final decision:** none yet — this was investigation-only per the task brief.
Recommendation above is ready for approval; the only remaining open question
(exact re-encode quality setting) can be closed with the broader zero-cost
local A/B pass, not a new benchmark mode or any paid provider call.

**Follow-up actions.**
1. Run the broader 5–8-product visual A/B pass to settle the exact mozjpeg
   quality setting (or confirm q90–92 holds).
2. If approved, implement on a fresh branch off current `main` (the old
   `feature/generation-quality-option` is merged/closed) — small, scoped: one
   re-encode function + the `ShareModelImage` fix.
3. Consider whether `AiUsageEvent.responseBytes` should log the *stored*
   (re-encoded) size vs. the *raw Gemini* size, or both — useful to keep both
   for cost transparency (real stored bytes vs. what Gemini actually billed
   for) if this ships.

---

## 2026-07-04 — Implementation: post-generation re-encode + ShareModelImage fix

Retailer reviewed the compression comparison directly (a temporary admin page,
since the sandboxed visualization widget can't load `res.cloudinary.com` and
can't practically embed real images as base64 either — both hit hard limits
this session). Verdict: Original/q95/q90/production-q_auto/WebP80 all
indistinguishable; AVIF q70 showed very minor softness on close zoom only —
confirms the master should stay JPEG (mozjpeg) rather than adopt a modern
format for storage, leaving WebP/AVIF entirely to Cloudinary's existing
`f_auto` delivery-time negotiation. Approved for implementation.

**Shipped** on `feature/reencode-generated-images` (off current `main`):
- `lib/images/reencode.ts` — `reencodeGeneratedImage`, mozjpeg q90, non-fatal
  fallback to the original buffer on failure (matches the existing
  `preprocessProductImage` convention).
- Wired into `runGeminiImageGen` (`lib/generate-model-image.ts`) right after
  decoding Gemini's response, before the Cloudinary upload — so every
  generation path that shares this function (legacy `generateModelImage`,
  catalogue strategy, quick-listing's Gemini fallback) gets it automatically,
  at both Standard and Enhanced quality. `AiUsageEvent.metadata.outputImage`
  now logs both `sizeBytes` (raw, ties to Gemini's token billing) and
  `storedSizeBytes`/`storedMime` (what's actually persisted/served) — closes
  follow-up #3 above.
- `components/product/ShareModelImage.tsx` now routes through `masterUrl()`
  instead of the bare `modelImageUrl` — the one path that bypassed the
  delivery-variant system entirely.

**Verified live** (one real generation, approved in advance): a real catalogue
front+back generation showed raw Gemini output of 573KB/557KB re-encoding to
136KB/128KB stored (76-77% smaller) — consistent with the local A/B. Confirmed
the actual Cloudinary-served file matches the re-encoded size (not the raw
one), and visually inspected the stored result — clean, no artifacts.

**What this changes vs. what it doesn't.** Generation itself (prompts,
`imageConfig`, resolution) is completely untouched — this operates strictly on
Gemini's response before it's stored. The existing delivery-variant system
(`f_auto,q_auto` in `lib/images/variants.ts`) is unchanged and still does its
job; it now just starts from a smaller, more efficient base file.

---

## 2026-07-13 — Garment Intelligence pipeline stage (see dedicated doc)

The craftsmanship-fidelity thread running through this log (flat "printed"
embroidery in generations; the manual detail-notes injection experiment that
significantly improved it) has graduated into its own R&D track: a dedicated
**Garment Intelligence** stage between metadata extraction and the prompt
builder — hierarchical (whole-image + region close-ups) Gemini Vision
analysis producing structured, cached, reusable garment understanding,
rendered deterministically into the existing `detailNotes` prompt channel.

Full architecture, decisions, Claude Vision discussion and roadmap:
[`GARMENT_INTELLIGENCE_RND.md`](GARMENT_INTELLIGENCE_RND.md). Branch:
`rnd/garment-intelligence`, flag-gated by `ENABLE_GARMENT_INTELLIGENCE`
(default off — no behavior change until enabled).

---

## 2026-07-14 — Incident: storage outage burned paid generations; layered cost protection added

**Incident.** Every generation "failed" with `Gemini gen error … 499
TimeoutError` despite Gemini returning 200. Diagnosis (probes outside the
app): the dev network's path to `api.cloudinary.com` was degraded —
intermittent DNS `ENOTFOUND` plus ~17s API latency when it did connect — so
the post-generation Cloudinary upload timed out while downloads
(`res.cloudinary.com`) worked fine. NOT a code/GI regression (GI calls
succeeded throughout; a standalone 100-byte upload reproduced the failure).
Gemini bills on response, so every lost upload was a paid generation with no
stored image — and, worse, no `ai_usage_events` row.

**Key fact.** Gemini's generateContent returns image bytes inline and
retains nothing server-side: an image that isn't stored by us immediately is
unrecoverable. Regeneration is the only recovery, at full price.

**Layered protection shipped** (branch `rnd/garment-intelligence`):
1. **Pre-flight storage gate** — `checkCloudinaryReachable()` runs before
   ANY paid call in the generation engine; storage down → abort with
   `failure: "storage_unreachable"`, zero spend. Fails open on ambiguity
   (any HTTP answer counts as reachable), closed only on no-response.
2. **Upload resilience** — 120s timeout (observed degraded latency exceeds
   the 60s SDK default) + one retry with 3s backoff (DNS flaps fail in ms).
3. **Ledger integrity** — an upload failure after a successful generation
   now records the run with real token counts (`cloudinary_upload: …`), so
   paid-but-lost generations are visible in /admin/usage instead of vanishing.
4. **Honest retailer messaging** — the generate route returns
   `failure`/`failureMessage`; the product page shows an amber banner
   ("storage temporarily unreachable — no AI usage was spent — try again in
   a few minutes" / "generation didn't complete — retry from the ⋯ menu")
   instead of a spinner that silently gives up.

**Residual risk (documented, not closed).** Storage can still die in the
window between pre-flight and upload; the retry covers blips, not a
mid-flight outage. The complete fix is a durable local buffer + background
upload queue for generated bytes ("never lose a paid generation") — roadmap,
not built: meaningful infra for a rare residual case.
