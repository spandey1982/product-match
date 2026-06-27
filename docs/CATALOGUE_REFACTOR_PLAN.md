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

## R2 — Card-stack architecture 🔜

- `lib/product/part-slots.ts` — add a per-category **card-stack** definition (ordered display cards + source rule `ai-base | model-crop | upload:<slot>`). Pure data.
- `lib/model-gen/catalogue-cards.ts` *(new)* — resolver: product + parsed `partImages` + base shots → ordered final cards (with fallback to base-crop).
- `lib/images/enhance.ts` *(new)* — non-AI Cloudinary enhancement (`e_improve`, mild `e_sharpen`, trim) + 3:4 `c_fill,g_auto`. 🔬
- `lib/model-gen/strategies/catalogue.ts` — generate base shots **at 3:4** 🔬; build the stack via the resolver instead of inline `resolveCloseUps`.
- `lib/generate-model-image.ts` — Gemini request: add 3:4 portrait aspect. 🔬
- `lib/model-gen/engine.ts` — pass parsed `partImages` to the strategy; brand **last** over the finished stack.
- `lib/model-gen/persist.ts` — persist the stack; infer source from `view` (no schema migration).
- `app/(dashboard)/products/[id]/ProductDetailView.tsx` — render the resolved stack; labels per card.

## R3 — Coverage-aware brand placement ⏳

- `lib/model-gen/studio-anchor.ts` — sample all 4 card corners (avg + busyness/variance).
- `lib/model-gen/branding.ts` — `resolveBrandingPlacement(card)`: place the mark in the calmest corner (least product), with the adaptive colour we already compute. Brand on the **card** canvas (top-right by default once 3:4 source lands; overridden by the calmest corner when that's product).

## Open decisions / verification gates

- 🔬 Verify the R1 rendering fix restored detail + full-screen for all products.
- 🔬 Confirm Gemini reliably honours a 3:4 request; else fall back to a reliable crop/pad on base.
- ⏳ Vertex reference images → 3:4 (asset task) for native-uniform Vertex output.
- Storage: no larger originals stored (controlled resize at same sizes).
