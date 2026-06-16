# Reference Models

Curated, version-controlled reference-model images used by the AI Generation
engine (`lib/model-gen/`). They are read **server-side** as buffers (to feed the
generation backends — Vertex needs the model as the "person") and also served
over HTTP for UI thumbnails.

## Filename convention

```
{type}-{variant}.{ext}
```

- **type** (visible to retailers): `woman` · `man` · `girl` · `boy`
- **variant** (internal, category-driven): `basic` · `saree` · `lehenga` · `kurti` · `western`
- **ext**: `webp` · `png` · `jpg`

### What a variant actually is (important)

A variant is the **same base model already wearing that garment type, properly
draped** — NOT a new model and NOT plain clothing:

- `woman-basic` — the base model in minimal neutral clothing.
- `woman-saree` — *that same woman* wearing a well-draped saree.
- `woman-lehenga` — the same woman in a lehenga; `woman-kurti` — in a kurti; etc.

Why: when a product is categorised (e.g. `saree`), the app feeds the matching
**draped** model as the person image. Vertex takes no prompt, so a saree-draped
person image is what tells it how the new saree product should sit. Gemini gets
the same model plus a metadata prompt. A plain model for a saree gives Vertex no
drape cue — which is the whole point of having variants.

The loader tries the requested variant, then falls back to `basic`, then to
"no reference" (graceful degradation — generation never breaks if a file is
missing). At minimum supply the `*-basic` images; the draped variants are what
lift quality for those categories.

## Expected files

| | basic | saree | lehenga | kurti |
|---|---|---|---|---|
| woman | `woman-basic` | `woman-saree` | `woman-lehenga` | `woman-kurti` |
| man   | `man-basic`   | — | — | — |
| girl  | `girl-basic`  | `girl-saree` | `girl-lehenga` | `girl-kurti` |
| boy   | `boy-basic`   | — | — | — |

man/boy use `basic` only — it covers their range (including western). `western`
remains a valid variant for woman if you want a dedicated western-wear model;
otherwise western products fall back to `*-basic`.

`*-basic` thumbnails (referenced by `MODEL_TYPES` in `reference-models.ts`) are
also shown in the store-model picker, so keep them clean front-facing shots.

## Guidance

- Full-body, neutral/light background, even lighting, relaxed front pose.
- **Same identity + framing across a model's variants** (same woman, same crop,
  just different garment) — this is what keeps generations consistent.
- Recommended ~1024px on the long edge; keep files reasonably small.
- No text/watermarks.

## Future

Hosting may later move to Cloudinary, and retailers may upload **custom**
reference models — see `docs/IMAGE_AI_ROADMAP.md`.
