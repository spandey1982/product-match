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
- **ext**: `webp` (preferred) · `png` · `jpg`

The loader tries the requested variant, then falls back to `basic`, then to
"no reference" (graceful degradation — generation never breaks if a file is
missing). So at minimum supply the `*-basic` images; add drape-specific variants
to improve quality.

## Expected files

| | basic | saree | lehenga | kurti | western |
|---|---|---|---|---|---|
| woman | `woman-basic` | `woman-saree` | `woman-lehenga` | `woman-kurti` | `woman-western` |
| man   | `man-basic`   | — | — | — | `man-western` |
| girl  | `girl-basic`  | `girl-saree` | `girl-lehenga` | `girl-kurti` | — |
| boy   | `boy-basic`   | — | — | — | `boy-western` |

`*-basic` thumbnails (referenced by `MODEL_TYPES` in `reference-models.ts`) are
also shown in the store-model picker, so keep them clean front-facing shots.

## Guidance

- Full-body, neutral/light background, even lighting, relaxed front pose.
- Consistent framing across variants of the same model (improves consistency).
- Recommended ~1024px on the long edge; keep files reasonably small.
- No text/watermarks.

## Future

Hosting may later move to Cloudinary, and retailers may upload **custom**
reference models — see `docs/IMAGE_AI_ROADMAP.md`.
