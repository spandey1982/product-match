# Face Reference Library

Portrait-only reference assets for AI Casting. Each file conditions the
**identity** of the generated model (bone structure, tonal warmth, ethnic
character) — nothing else. Pose, body, drape and garment come from the existing
variant references one directory up (`../{type}-{variant}-{profile}.*`).

## Naming

`{region}-{sex}-{n}.{ext}` — e.g. `north-f-1.webp`, `global-m-1.png`.

- `region`: `north` | `south` | `east` | `west` | `north-east` | `global`
- `sex`: `f` (female) | `m` (male)
- `n`: 1-based sequence within (region, sex) — future variants add 2, 3, …
- Preferred extension: `.webp`. Accepted fallbacks: `.png`, `.jpg`, `.jpeg`.

The registry in [`lib/model-gen/faces.ts`](../../../lib/model-gen/faces.ts) is
the source of truth for which ids are expected; the loader picks the first
matching extension it finds.

## Asset spec

- Square or near-square portrait (1:1 or 4:5), head-and-shoulders framing.
- Neutral expression, neutral wardrobe, plain neutral background.
- Even studio lighting — no strong directional shadow that would fight the
  variant ref's own lighting during generation.
- No jewelry, no logos, no visible garment detail (a plain neckline is fine).
- Consistent focal length across the library so scale reads consistently.

## Missing assets

If a face id has no matching file on disk the loader returns `null` and the
generation path degrades to the current fused variant ref (identical to
today's behavior). Nothing breaks — the AI Casting improvement simply doesn't
apply for that face until the asset ships.
