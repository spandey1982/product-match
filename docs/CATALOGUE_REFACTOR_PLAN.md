# Catalogue Refactor Plan (R1–R3)

Status legend: ✅ done · 🔜 next · ⏳ planned · 🔬 needs in-app verification

Branch: `feature/backdrop-intelligence`.

## Goal

Catalogue cards are sourced from the retailer's **uploaded, high-fidelity** images
(lightly enhanced, non-AI), with AI base shots `(b)` for front/back and
model-crops `(c)` only where a detail exists *only* on the model. Branding is
applied **last, on the card**. Uploads stay high-fidelity; every downstream feed
is a *controlled* resize. Good results, balanced against storage/cost.

## Pipeline layers (don't break these — they're orthogonal)

1. Client resize — controlled `createImageBitmap` high-quality (R1).
2. Server upload (`/api/upload`) — store master (~1280), no enlargement.
3. AI input preprocess (`lib/images/preprocess.ts`) — Lanczos3 → **1024** + sharpen + WebP.
4. Delivery variants (`lib/images/variants.ts`) — master 2048↑ / display 1200 / thumb 400, inserted before `/v`.
5. Crop close-ups (`crop-templates.ts`) — `c_crop` after `/upload/`.
6. Branding (`branding.ts`) — overlay inserted before `/v` (after crop), adaptive colour + relative size.
7. (Removed) display-time `c_pad` normalize — produced broken URLs; replaced by generate-at-AR.

## Aspect-ratio strategy (decided + VERIFIED)

Both the catalogue grid card and the product-detail card are `aspect-[3/4]`.
Uniform dimensions are achieved with a **verified Cloudinary transform** at
delivery — no generation change or asset rework needed.

- **Base `(b)` (both providers):** ✅ `normalizeCatalogueUrl` =
  `c_pad,ar_3:4,w_1200,b_auto:border` — pads to 3:4, extends the detected edge
  colour into the bars (blends into beige Gemini OR grey Vertex). Verified 200
  for the full chain (pad → branding → delivery variant). Applied at display for
  full-body views; existing products get it immediately, no regeneration.
- **Extras (enhanced uploads + `(c)` crops):** ✅ `c_fill,g_auto,ar_3:4,w_1200`
  (verified 200) — reliable crop-to-fill, no padding.
- **`b_blurred` is INVALID** as a background token on this plan (Cloudinary reads
  it as a colour named "blurred" → 400). This single token blanked every
  detail/full-screen image; root-caused via the demo-cloud transform validator.
- Generate-at-3:4 / 3:4 reference images are now OPTIONAL (the delivery transform
  already gives uniformity), kept only as a future quality nicety.
- **Pallu crop** comes from the **BACK** base (the spread drape), not the front.

## Per-category upload → display

`(b)` AI base · `(c)` crop from generated front · others = enhanced uploaded image. Zoom ≤ 2.5×.

| Category | Upload | Show |
|---|---|---|
| Saree | Main, Pallu, Border, Blouse front, Blouse back | Front(b), Back(b), Border, Pallu, Pleats(c), Blouse (=blouse-front) |
| Lehenga | Lehenga, Choli front, Choli back, Dupatta | Front(b), Back(b), Lehenga, Choli front, Choli back, Dupatta |
| Kurti/Kurta | Front, Back, Salwar | Front(b), Back(b), Salwar(c) |
| Blouse/Waistcoat/Shirt/T-shirt/Trouser | Front, Back | Front(b), Back(b) |
| Men suit | Coat front, Coat back, Trouser front, Trouser back, Waistcoat front | Front(b), Back(b) |

Source resolution per display card:
1. `(b)` front/back → base shots.
2. `(c)` pleats/salwar → crop of the generated front base.
3. enhanced upload → uploaded image + non-AI enhancement.
4. **Fallback:** upload missing → crop the base (today's `crop-templates`).

---

## R1 — Controlled upload/resize ✅ (commits d1af9ca …)

- ✅ Client `resizeImage` → `createImageBitmap` `resizeQuality:"high"` (Lanczos-class), full original in memory, legacy canvas fallback. Stored size/cost unchanged; >5 MB flow-breaker gone.
- ✅ Generation input cap 1280 → 1024 (`preprocess.ts`).
- ✅ Part/detail images share the controlled path.

## R2 — Card-stack architecture ✅

- ✅ `lib/product/part-slots.ts` — per-category **card-stack** definition (ordered cards + source rule `ai-base | model-crop | upload`, with `fallbackCropId`).
- ✅ `lib/model-gen/catalogue-cards.ts` — resolver: card model + `partImages` + base shots → ordered final cards (upload→base-crop fallback; "main" slot → product image; border omitted when absent).
- ✅ `lib/images/enhance.ts` — non-AI Cloudinary enhancement `c_fill,g_auto,ar_3:4,w_1200,e_improve,e_sharpen:60` (verified 200).
- ✅ `lib/model-gen/crop-templates.ts` — `cropRegionFor(category, id)`; pallu now from BACK; new kurti salwar region.
- ✅ `lib/model-gen/strategies/catalogue.ts` — builds the stack via the resolver (replaces the inline crop loop).
- ✅ `lib/model-gen/engine.ts` — passes `partImages`; records only `source !== "upload"`.
- ✅ `lib/model-gen/persist.ts` — `GeneratedImage.source`; stack persisted; source inferred from `view` at display (no migration).
- Base 3:4 uniformity via the verified `normalizeCatalogueUrl` (display) — generate-at-3:4 dropped as unnecessary.
- 🔬 Verify end-to-end in-app: generate a saree + a kurti, confirm the card stacks, enhancement, fallbacks, and brand placement.

## R3 — Coverage-aware brand placement ✅

- ✅ `lib/model-gen/studio-anchor.ts` — `sampleRegionStat`: a corner as a 16×16 grid → avg colour + luminance variance (low = flat backdrop, high = busy).
- ✅ `lib/model-gen/branding.ts` — `resolveBrandingPlacement`: samples all 4 corners, places the mark in the calmest (configured corner wins within 25%), with the adaptive colour for that corner. `applyBranding`/`buildOverlayTransform` take the resolved placement.
- ✅ `lib/model-gen/engine.ts` — brands each card via `resolveBrandingPlacement`.
- 🔬 Verify in-app: the product-filled close-up that overlapped now puts the mark in a clear corner.

## Open decisions / verification gates

- 🔬 Verify the R1 rendering fix restored detail + full-screen for all products.
- 🔬 Confirm Gemini reliably honours a 3:4 request; else fall back to a reliable crop/pad on base.
- ⏳ Vertex reference images → 3:4 (asset task) for native-uniform Vertex output.
- Storage: no larger originals stored (controlled resize at same sizes).
