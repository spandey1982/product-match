# Reference Models

Curated, version-controlled reference-model images used by the AI Generation
engine (`lib/model-gen/`). They are read **server-side** as buffers (to feed the
generation backends — Vertex needs the model as the "person") and also served
over HTTP for UI thumbnails.

## Filename convention

```
{type}-{variant}-{profile}.{ext}   (preferred — separate front/back shots)
{type}-{variant}.{ext}             (legacy — single shot, used for both profiles)
```

- **type** (visible to retailers): `woman` · `man` · `girl` · `boy`
- **variant** (internal, category-driven): `basic`/`base` · `saree` · `lehenga` · `kurti` · `western`
- **profile** (optional): `front` · `back` — a front-only model still works fine; the
  loader falls back to the front shot for a requested back profile (or to the
  legacy single-shot name) rather than failing, so adding `-back` later is a
  drop-in upgrade with no code changes.
- **ext**: `webp` · `png` · `jpg`

### What a variant actually is (important)

A variant is the **same base model already wearing that garment type, properly
draped** — NOT a new model and NOT plain clothing:

- `woman-base-front` / `woman-base-back` — the base model in minimal neutral
  clothing, front and back shots.
- `woman-saree-front` / `woman-saree-back` — *that same woman* wearing a
  well-draped saree.
- `woman-lehenga-*` — the same woman in a lehenga; `woman-kurti-*` — in a
  kurti; etc.

Why: when a product is categorised (e.g. `saree`), the app feeds the matching
**draped** model as the person image. Vertex takes no prompt, so a saree-draped
person image is what tells it how the new saree product should sit. Gemini gets
the same model plus a metadata prompt. A plain model for a saree gives Vertex no
drape cue — which is the whole point of having variants.

The loader tries the requested variant + profile first, then the same variant
without a profile suffix (legacy single shot), then falls back to `basic`/`base`,
then to "no reference" — graceful degradation, generation never breaks if a
file is missing. At minimum supply a `*-base-front` image; front/back pairs and
the draped variants are what lift quality further.

## Expected files

| | basic (front/back) | saree | lehenga | kurti |
|---|---|---|---|---|
| woman | `woman-base-front` / `woman-base-back` | `woman-saree-front/back` | `woman-lehenga-front/back` | `woman-kurti-front/back` |
| man   | `man-base-front` / `man-base-back` | — | — | — |
| girl  | `girl-base-front` (back pending) | `girl-saree` | `girl-lehenga` | `girl-kurti` |
| boy   | `boy-base-front` (back pending) | — | — | — |

man/boy use the basic variant only — it covers their range (including western).
`western` remains a valid variant for woman if you want a dedicated
western-wear model; otherwise western products fall back to `*-base-front`.

`*-base-front` thumbnails (referenced by `MODEL_TYPES` in `reference-models.ts`)
are also shown in the store-model picker, so keep them clean front-facing shots.

## Guidance

- Full-body, neutral/light background, even lighting, relaxed front pose.
- **Same identity + framing across a model's variants** (same woman, same crop,
  just different garment) — this is what keeps generations consistent.
- Recommended ~1024px on the long edge; keep files reasonably small.
- No text/watermarks.

## Future

Hosting may later move to Cloudinary, and retailers may upload **custom**
reference models — see `docs/IMAGE_AI_ROADMAP.md`.
