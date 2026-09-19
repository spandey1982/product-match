# Home Material Intelligence — AI Boundaries

Part of the domain-scoped docs split approved 2026-09-10 — see
`../README.md` for the index. This is the STATIC reference table (locked
per Constitution §15). For the detailed, dated history of how each layer
was actually built, tested, and hardened — including every bug found and
fixed along the way — see `../changelog.md`.

| Layer | Responsibility | Not responsible for |
|---|---|---|
| Computer Vision | Wall/surface/furniture/window/door detection, geometry, lighting, structured facts only. `lib/home-material/wall-detection.ts` does single/multi-wall polygon detection (up to 5 candidates) for a straight-on or moderately-angled photo, including an optional perspective quad (`corners`), a truncation flag (`possiblyTruncated`), and (as of 2026-09-10) AI-suggested wall adjacency (`lib/home-material/adjacency-detection.ts`, suggest-only). General panoramic/wide-angle multi-wall reconstruction (sub-problem D) is permanently deferred — see `../product/overview.md` | Commercial recommendations |
| Material Knowledge | Category-level properties (durability, maintenance, moisture, install/removal), curated/config data (`lib/home-material/material-taxonomy.ts`) | Being generated live per-request |
| Product DB | SKU facts, identity, attributes, source/evidence (`HmProduct`, `HmProductEvidence`) | Being defined by the image model |
| Recommendation Engine | Deterministic/hybrid scoring over room + requirements + material + product data (`lib/home-material/recommendation.ts`, `lib/home-material/combination-recommendation.ts`) | Arbitrary LLM-invented scores |
| Visualization Engine | Applying material to a surface; pattern scale/repeat/orientation; preserving everything else (`lib/home-material/visualization.ts` — three deterministic non-Gemini paths: perspective homography, true-scale tiling, and their fallback to a masked Gemini edit) | Silently substituting a similar-looking material for the real SKU |
| LLM | NL understanding, explanations, comparisons, summaries over already-computed structured results (`lib/home-material/overview.ts`'s mandatory post-generation "honest overview") | Being an uncontrolled source of product specs |
