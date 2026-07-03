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
