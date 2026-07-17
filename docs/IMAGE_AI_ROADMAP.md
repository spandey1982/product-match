# Image AI — Architecture, Decisions & Roadmap

> **Living document.** This is the single source of truth for the virtual try-on
> and model-image-generation work. If a chat is lost, point Claude here first.
> Update it whenever a decision is made or a task lands.
>
> R&D/benchmark findings (not yet, or never, promoted to production) live in
> `docs/research/IMAGE_RND_LOG.md` — check there for prior experiments before
> re-running one. That work happens on the local-only `rnd/image-pipeline-benchmarks`
> branch (never pushed); only approved results land here.
>
> Last updated: 2026-07-06

---

## 1. Purpose

Product Match is a B2B SaaS for Indian ethnic-fashion retailers. Two AI image
features support the catalog:

- **Virtual try-on** — put a shopper's photo into a product (multi-vendor).
- **Model-image generation** — generate an "on-model" catalog photo from product
  images (Gemini-only engine, evolving).

## 2. Prime directive (applies to every change)

Additive only. Never remove or break existing functionality unless explicitly
told. Every change must improve **UX, cost-effectiveness, speed, or correctness**
— and never degrade any of them. Prefer designs that are easy to extend later
over clever ones that must be torn out.

## 3. The two axes (do NOT conflate them)

| Axis | Varies by | Providers | Abstraction |
|---|---|---|---|
| **Try-on** | vendor | Gemini VTO, Vertex `virtual-try-on-001` | `lib/providers/` (`TryOnProvider` + factory) |
| **Model-gen** | Gemini model + prompt + knowledge | Gemini only (Vertex structurally can't — it needs a person image) | *future engine; intentionally NOT a provider* |

Conflating them onto one interface would force a teardown when the model-gen
prompt/RAG engine arrives. Keep them separate.

## 4. Current architecture

**Try-on**
- `lib/tryon.ts` — `generateTryOn()`, Gemini (`gemini-3.1-flash-image`). Stateless; result → Cloudinary `product-match/tryon/`.
- `lib/tryon-vertex.ts` — `generateTryOnVertex()`, Vertex `virtual-try-on-001` (GA), OAuth via `google-auth-library` ADC. Feature-flagged `ENABLE_VERTEX_TRYON`. Result → Cloudinary `product-match/tryon-vertex/`.
- `lib/providers/` — `TryOnProvider` interface, `geminiTryOnProvider`, `vertexTryOnProvider`, factory (`getTryOnProvider`, `DEFAULT_TRYON_PROVIDER_ID = "gemini"`, `listTryOnProviders`), `active.ts` (`getActiveTryOnProvider`), `auto-routing.ts` (category→provider).
- Routes: `app/api/products/[id]/tryon` (resolves active provider) and `.../tryon-vertex` (explicit/testing). Both go through the factory.
- UI: trial-room components + catalog/product try-on buttons → POST `/tryon`.

**Model-gen** (now objective-driven — see §11)
- `lib/generate-model-image.ts` — legacy `generateModelImage(productId)` (Gemini `gemini-3.1-flash-image`, single image → `products.modelImageUrl`) is preserved as the default/flag-off path. The Gemini call + source-image loader are now exported (`runGeminiImageGen`, `fetchProductImageBuffer`) and reused by the model-gen engine.
- `lib/model-gen/` — the objective-based **Model Generation engine** (§11). Intent-keyed, NOT a provider abstraction.
- Triggered from upload flow + `app/api/products/[id]/generate-model-image` (now accepts `{ objective, modelType }`).

**Shared**
- `lib/research-log.ts` → `logs/tryon-research.jsonl` — append-only log of every generation (inputs/outputs/timings/provider). **This is the seed corpus for the future learning loop.** Extend, never replace.
- Storage: Cloudinary. DB: PostgreSQL (dev + prod) via Prisma 7.

## 5. Provider resolution & precedence

Single override point: `getActiveTryOnProvider(retailerUserId, { category })` in
`lib/providers/active.ts`. Precedence (each overrides the one below):

```
customer choice (Task 5, future)
  ▸ automatic routing (Task 4)        — when retailer mode = "auto"
    ▸ admin default (Task 3)          — retailer's User.tryOnProvider
      ▸ system default = Gemini (Task 2)
```

Capability-aware fallback at every layer: a selected/ routed provider that isn't
`isEnabled()` falls back to Gemini, so try-on never breaks.

## 6. Decisions log (constraints learned the hard way)

- **AI Studio `gen-lang-client-*` projects cannot run Vertex predict** (even `gemini-2.0-flash` 403s there). Vertex needs a **standard GCP project** with Vertex AI API enabled, billing active, and the identity holding `roles/aiplatform.user` (NOT "AI Platform Admin" = legacy `roles/ml.admin`).
- **Auth is ADC-based** (no hardcoded key). Works with: user ADC (local), SA key file (`GOOGLE_APPLICATION_CREDENTIALS`), inline base64 key (`GOOGLE_APPLICATION_CREDENTIALS_JSON`, for Railway/Vercel — **implemented**), attached SA (Cloud Run, keyless), WIF. `gcloud auth application-default login` is **local-only**.
- Gemini (API key) and Vertex (GCP project) can live on **different projects**; they share nothing.
- **Stale Prisma client gotcha:** after a schema change, the dev server caches the old client → `PrismaClientValidationError`. Fix: `npx prisma generate` → restart `npm run dev` (clear `.next` if it persists).
- **Stale dev build gotcha:** long-lived browser tab + restarted dev server → 404s / `Unexpected token '<' … DOCTYPE` (RSC fetch gets HTML). Fix: clear `.next`, restart, hard-refresh.
- **Windows lockfile vs Linux `npm ci` gotcha:** `npm install` on Windows strips Linux-only optional nodes (`@emnapi/*`, transitive deps of `@napi-rs/wasm-runtime`) from `package-lock.json`, so Railway's `npm ci` fails ("package.json and package-lock.json … not in sync"). **Permanent fix:** deploy with `npm install` instead of `npm ci` — `nixpacks.toml` sets this, or Railway dashboard → Settings → Build → Custom Install Command → `npm install`. Do not rely on hand-patching the lockfile (re-stripped on the next Windows `npm install`). Alternatively, generate/commit the lockfile on Linux/WSL.
- Vertex VTO is image-only (no text prompt / metadata). It is **strong on structured/western apparel and shoes, weak on complex Indian drapes** (folded saree/lehenga/dupatta). Gemini's prompt-based approach handles drapes better. This drives auto-routing (§7, Task 4).

## 7. Roadmap

### Done
- **Task 1** — Vertex VTO as a second provider (feature-flagged). ✅
- **Task 2** — Try-on provider abstraction (`lib/providers/`). ✅
- **Task 3** — Per-retailer admin provider selector (`User.tryOnProvider`, `/settings`). ✅
- **Task 4** — Automatic provider selection: opt-in **"Auto"** mode + deterministic category→provider rules (`auto-routing.ts`), capability-aware fallback, decision logging. ✅ *(see table below)*
- **Task 6** — **AI Generation Settings** (model-gen objectives). Outcome-first model generation: retailer picks an objective; the system resolves provider + reference + prompts internally. Reference-model library, category-aware reference + prompt sets, `ProductImage` gallery. Feature-flagged `ENABLE_AI_GEN_SETTINGS`. ✅ *(full design in §11)*

**Task 4 routing table (current defaults — Gemini for drape, Vertex for structured):**
| Category | Provider |
|---|---|
| saree, lehenga, dupatta, anarkali, gown | Gemini |
| kurti, kurta, shirt, top, blouse, palazzo, trousers, skirt, dress, co-ord | Vertex |
| footwear | Vertex |
| jewellery, handbag, clutch | Gemini |
| (unmapped) | Gemini (fallback) |

### Descoped
- **Task 5** — Customer-facing provider selection. **Dropped (2026-06-15).**
  Decision: provider/quality is a *retailer* choice, not an end-shopper toggle
  (B2B tool serving customers through retailers). Tasks 3 + 4 already give the
  retailer full control (force a provider, or Auto-by-category). The
  `getActiveTryOnProvider` resolver still has room for a customer layer if this
  is ever revisited, but it is not planned.

### Deployment auth (Railway target)
Railway is non-GCP, so Vertex needs a credential the server can use headlessly:
- **Keyless (WIF):** ideal but Railway isn't a first-class GCP OIDC provider — impractical.
- **SA key via inline env var (implemented):** set `GOOGLE_APPLICATION_CREDENTIALS_JSON`
  to the base64 of a JSON key; `buildAuth()` in `lib/tryon-vertex.ts` decodes it and
  passes `GoogleAuth({ credentials })`. Needs a key from a project that (a) can run
  Vertex and (b) *allows* key creation — a fresh **standard** project under an
  account/org without `iam.disableServiceAccountKeyCreation`. (Working setup:
  project `vertex-ai-vto`, SA `vertex-vto-sa`, `roles/aiplatform.user`.)
- **Vertex is never a deploy blocker:** ship with `ENABLE_VERTEX_TRYON=false`
  (Gemini-only) and enable Vertex later with env vars only, no code redeploy.

## 8. Future implementation notes (planned, NOT yet built)

These are explicitly desired; the current code is shaped so they slot in
without rework.

- **Multi-Gemini-model selection.** Offer several Gemini models to choose from
  (per feature). Try-on and model-gen each get a model list; admin picks.
- **Admin-configurable routing.** Let a store admin set the category→provider
  mapping (and later model selection) from `/settings` — promoting the current
  hardcoded `auto-routing.ts` table to per-retailer config (needs storage:
  a `RetailerSettings`/`RoutingRule` table or JSON column).
- **Progressive routing signals** (Task 4 chose option 1; 2 and 3 are the future
  path, in order):
  1. ✅ deterministic category rules (now)
  2. + extra product signals (gender, material, drape attributes)
  3. data-driven / learned routing from observed success rates per
     category×provider (feeds from the research log).
- **Model-Generation Engine** (its own track): multi-image garment decomposition
  — saree → pallu / blouse / top-drape / bottom-drape; female suit → top /
  bottom / back; lehenga → ghaghara / blouse / dupatta — plus per-garment
  **prompt templates**, selectable Gemini models, and a **RAG / self-learning**
  loop seeded by `logs/tryon-research.jsonl`. Goal: flawless, platform-ready
  model shots. Will need an additive storage extension for labeled part-images.
- **Self-learning system (RAG).** Persist (garment type, prompt, inputs, output,
  quality signal) tuples; retrieve best prompts/examples per garment; few-shot
  the generation call; improve with usage. Build on the research log.

## 9. Operational notes

**Env vars** (see `docs/VERTEX_TRYON_SETUP.md` for full setup):
```
ENABLE_VERTEX_TRYON, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION,
GOOGLE_APPLICATION_CREDENTIALS        # local: SA key file path (empty → ADC)
GOOGLE_APPLICATION_CREDENTIALS_JSON   # deploy: SA key as base64 JSON (Railway/Vercel)
GEMINI_API_KEY                        # Gemini provider + model-gen (separate project)
ENABLE_AI_GEN_SETTINGS                # model-gen objectives UI + routing (off → legacy single image)
ENABLE_AI_REVIEW                      # async AI quality scoring of generated images (off → no scoring)
AI_REVIEW_SAMPLE_RATE                 # 0–1 fraction of base shots to review (default 1)
ADMIN_EMAILS                          # comma-separated allowlist for the internal review panel
```
Quick Listing uses Vertex VTO with the reference model as the person, so it
benefits from the same `ENABLE_VERTEX_TRYON` + GCP config above; without it,
Quick Listing transparently falls back to the Gemini path.
Validation each task: `npx tsc --noEmit` + `npm run lint` + manual flows.
Schema changes: `npx prisma generate` then restart dev server.

## 10. File / anchor map

| Concern | File |
|---|---|
| Try-on provider interface/factory | `lib/providers/{types,index}.ts` |
| Gemini / Vertex providers | `lib/providers/{gemini,vertex}-provider.ts` |
| Active provider resolver (precedence) | `lib/providers/active.ts` |
| Auto category routing | `lib/providers/auto-routing.ts` |
| Gemini try-on impl | `lib/tryon.ts` |
| Vertex try-on impl | `lib/tryon-vertex.ts` |
| Model-image gen impl (legacy + shared Gemini core) | `lib/generate-model-image.ts` |
| Model-gen engine (objectives) | `lib/model-gen/engine.ts` |
| Objectives / reference library / category selection / prompt sets | `lib/model-gen/{objectives,reference-models,reference-selection,prompt-sets}.ts` |
| Auto model-type selection (gender/age) | `lib/model-gen/model-selection.ts` |
| Shared metadata service (provider-agnostic) | `lib/metadata/analyze.ts` (`Product.pattern`) |
| Crop-template system (catalogue close-ups) | `lib/model-gen/crop-templates.ts` |
| Image variant delivery (master/display/thumbnail) | `lib/images/variants.ts` |
| Front/back reference profiles | `lib/model-gen/reference-models.ts` (`loadReferenceImage(..., {profile})`) |
| Generation perf/quality records | `GenerationRecord` table, `lib/model-gen/generation-record.ts` |
| Automated AI review (quality scoring) | `lib/model-gen/ai-review.ts` (`ENABLE_AI_REVIEW`) |
| Manual review panel (internal, admin) | `app/(dashboard)/admin/review/`, `app/api/admin/review/route.ts` (`ADMIN_EMAILS`) |
| Model-gen strategies | `lib/model-gen/strategies/{quick-listing,catalogue}.ts` |
| AI-gen settings (storage accessor + API) | `lib/model-gen/settings.ts`, `app/api/settings/ai-generation/route.ts` |
| Store branding overlay | `lib/model-gen/branding.ts` |
| Scenic Collection (Scene Library, rule engine, Prompt Builder, negative prompts) | `lib/model-gen/scenes/{types,library,rule-engine,color-harmony,prompt-builder,negative-prompts,selection}.ts` (§12) |
| Logo upload/delete | `app/api/settings/logo/route.ts` (`User.logoPublicId`) |
| Reference-model generator (offline team tool) | `scripts/generate-reference-models.ts` (`npm run gen:reference-models`) |
| Reference assets | `public/reference-models/` (see its README) |
| Try-on routes | `app/api/products/[id]/{tryon,tryon-vertex}/route.ts` |
| Admin provider setting | `app/api/settings/tryon-provider/route.ts`, `app/(dashboard)/settings/` |
| Research log (learning seed) | `lib/research-log.ts`, `logs/tryon-research.jsonl` |
| Setup guide | `docs/VERTEX_TRYON_SETUP.md` |

## 11. AI Generation Settings (model-gen objectives)

**Principle.** Retailers choose an **outcome (objective)**, never a provider. The
system resolves provider, reference asset, prompts and strategy internally.
Provider names (Gemini/Vertex) and model IDs stay implementation details. Model
generation and try-on remain separate axes (§3).

**Objectives** (`lib/model-gen/objectives.ts`):
| Objective (retailer sees) | Strategy | Internal backend |
|---|---|---|
| **Quick Listing** | single | Vertex VTO( reference-model = person, product = garment ) → 1 image; **Gemini fallback** |
| **Catalogue & Social** | multi | Gemini prompt-based, one image per category view |

Quick Listing reconciles the §3 constraint that Vertex can't model-gen from
scratch: the **reference-model library supplies the person image** Vertex needs.

**Reference Model library** (`reference-models.ts`): visible types Woman/Man/Girl/Boy,
hidden variants `basic/saree/lehenga/kurti/western`. Assets are **bundled static**
files in `public/reference-models/` read server-side (zero network hop, free,
version-controlled, deterministic); thumbnails served over HTTP. Missing asset →
graceful degradation (no-reference Gemini; Vertex→Gemini).

A reference is resolved on two independent axes:
- **type** (woman/man/girl/boy) — auto-selected per product in `model-selection.ts`
  from sex (female-only categories like saree/lehenga/kurti/skirt override the
  gender field; else `Product.gender`) and age (GIRLS/BOYS = kid). Falls back to
  the store default only when the product gives no signal (e.g. a unisex
  accessory). The upload UI defaults to **Auto**; a concrete type is an override.
- **variant** (basic/saree/lehenga/…) — by category in `reference-selection.ts`.

Together they resolve a file like `woman-saree`. A variant asset must be the
**same base model wearing that garment, draped** (see the reference-models
README) — that draped person image is what guides Vertex (no prompt). Catalogue
view set + prompt composition live in `prompt-sets.ts`.

*Future:* several models per type with a per-type default; age inferred from
category too (e.g. "kids lehenga"). `model-selection.ts` is the single place
both grow.

**Resolution / fallback** (`engine.ts` → `generateModelImages`): explicit request
→ retailer stored defaults (`User.aiGenSettings`) → strategy. Capability-aware
fallback at every step, like try-on. Feature flag `ENABLE_AI_GEN_SETTINGS`
(off → legacy single-image path; route + UI unchanged).

**Catalogue provider (independent of try-on).** `aiGenSettings.catalogueProvider`
= Automatic | Natural Drape (Gemini) | Sharp Fit (Vertex). **Automatic is
category-routed, NOT all-Vertex** — it reuses `resolveAutoProvider` (drape→Gemini,
structured→Vertex), the deliberate choice for an ethnic-first catalogue. The
catalogue strategy generates each base shot via the chosen backend (Vertex = VTO
with the front/back reference as the person; Gemini = prompt + reference) with
per-view capability fallback to Gemini when Vertex is unavailable or a profile
reference is missing. Quick Listing keeps its Vertex-then-Gemini behaviour. The
try-on provider (`User.tryOnProvider`) is a separate axis, unchanged.

**Storage (decisions):**
- `User.aiGenSettings String?` (nullable JSON) — `{ defaultModelType, defaultObjective }`.
  One column avoids migration churn as the surface grows; read via `settings.ts`.
- `ProductImage` table (`product_images`) — multi-view gallery, one row per view
  (`url, view, objective, isPrimary`, cascade-deleted). `Product.modelImageUrl`
  **kept** as the legacy/primary single output (Quick Listing + primary catalogue
  view write it) so all existing UI is unchanged.

**Store branding on generated images** (`lib/model-gen/branding.ts`): generated
model images carry the store **logo** (Cloudinary image overlay) or, when no logo
is uploaded, the **store name** (text overlay). Applied as a non-destructive
Cloudinary transformation spliced into the delivery URL at the persist boundary,
so it covers both backends (Gemini catalogue + Vertex quick-listing) and the
legacy single-image path, and flows automatically to display/share/download — the
shared try-on upload path is untouched. Stored on `User.logoPublicId` (+ logo
upload/delete at `/api/settings/logo`); on/off lives in `aiGenSettings`
(`brandingEnabled`). No-op when disabled or when there's no logo and no store name.

**Watermark placement + style (updated 2026-07-16).** Placement is now fixed
**top-left** on every card — the retailer position picker and the coverage-aware
"calmest corner" search were removed (the variance heuristic mistook flat
product/skin for backdrop and had no good answer on busy Scenic frames). The
store-name wordmark has two retailer-selectable looks, stored in `aiGenSettings`
as `brandingStyle` (`"classic" | "glass"`, default `"classic"`), chosen via the
**Style** toggle under Image branding:
- **Classic** — the adaptive text wordmark (Arial bold, adaptive ivory/Onyx tone
  + soft shadow), pure Cloudinary URL transform.
- **Glass** — the wordmark centred on a **designed translucent frosted-glass chip
  PNG** overlaid behind it (gloss + rounded ends baked into the asset, since URL
  params can't produce them). Text offsets were *measured* (not guessed) to
  centre the mark in the chip — see `scratchpad/measure-chip.js` for the method.
  - **Asset dependency:** the Glass style overlays the Cloudinary asset
    `product-match/brand/glass-chip-2` (`GLASS_CHIP_ID` in `branding.ts`). It
    must exist in the Cloudinary account the app delivers from. It was uploaded
    to the account in `CLOUDINARY_CLOUD_NAME`; if a different account is ever
    used for production, re-upload the chip there (regenerate via
    `scratchpad/make-glass-chip.js`) or Glass branding will render without its
    chip. `brandingPosition` remains in the settings schema for back-compat but
    is ignored.

The old two `brandingPosition` values (`top-left`/`top-right`) are no longer used
for placement.

**Settings surface placement:** the chooser (objective + store model + branding)
lives in the
**product-creation/generation workflow** (upload flow), **not** the try-on
`/settings` screen. The try-on `/settings` screen has been re-skinned to
purpose-led, provider-free language too — "Automatic" (Recommended), "Natural
Drape" (Gemini, best for draped ethnic wear), "Sharp Fit" (Vertex, best for
structured/western + footwear). The underlying ids/storage (`auto/gemini/vertex`,
`User.tryOnProvider`) are unchanged; only the labels/descriptions changed.

**Generation performance tracking (Phase E, done).** Every objective-based
generation writes one `GenerationRecord` per image — `provider, category,
objective, view, outputUrl, createdAt` (+ nullable `generationMs`/`tokensTotal`
and AI/manual score columns). Standalone table (no FK to Product) so records are
durable analytics snapshots. Each image is tagged with the backend that produced
it (close-ups inherit their base shot's provider). Non-blocking/non-fatal. This
is the queryable store that AI review (Phase F) and manual review (Phase G)
scores attach to, and that data-driven catalogue Auto routing will read.

**Manual review panel (Phase G, done).** Internal-only `/admin/review` (under the
dashboard, **not linked anywhere**) gated by `isAdmin` (role `ADMIN` or the
`ADMIN_EMAILS` allowlist). Reuses the `GenerationRecord` manual columns — a 1–5
rating per image alongside the AI scores; no new table. Non-admins get a 404.
Future Auto routing can blend AI + manual averages per category×provider.

**High-quality image pipeline (HQ steps 1–5, done).** One stored master →
three Cloudinary **delivery variants** (`lib/images/variants.ts`): MASTER
(`f_auto,q_auto,c_scale,w_2048,e_sharpen`) for zoom/download/social, DISPLAY
(~1200px), THUMBNAIL (~400px) — all with `f_auto`/`q_auto` (previously applied
nowhere). No extra stored files, no extra AI calls; variants compose with
existing branding/crop/normalize transforms. Viewers + downloads use MASTER
(the zoom fix); close-ups are cropped from the base and upscaled by the master
variant. `GenerationRecord` gained `modelName/width/height/fileSizeBytes` and
extended eval (`aiTextureQuality/aiProductVisibility/aiIssues`). Crop templates
now produce named close-ups (saree blouse/pallu/pleats, lehenga blouse/detail,
kurti design). **Deferred (team + Cloudinary-plan dependent):** generative AI
super-resolution tier (`e_upscale`/Real-ESRGAN) for true detail.

**Production image pipeline (resize + zoom + prompt enrichment).** Three
production changes from the vision-quality work (R&D — benchmarks/upscalers/
region-refinement — was evaluated separately and kept off `main`; only these
shipped):
1. **Controlled input preprocessing** (`lib/images/preprocess.ts`, wired into
   `runGeminiImageGen`). Live generation previously sent the *full upload* (≤5MB)
   to Gemini, which downsampled it with its own resampler — uncontrolled loss
   (there was **no 800px cap** in production; that figure only existed in the
   benchmark). Now: Lanczos3 → ~1280px (high-fidelity sweet spot; bigger wastes
   input tokens for diminishing understanding) + light sharpen + WebP-q90.
   Non-fatal fallback. (Lossless AVIF/WebP rejected — can't recover what the
   source JPG already lost, and AVIF API support is uncertain.)
2. **Full-screen viewer zoom** (`ProductImageViewer`). Tap/wheel zoom + drag-pan
   coexisting with the swipe carousel; per-slide caps (full shots 3×, crops 2×),
   no numeric readout.
3. **Prompt enrichment v1** (`lib/metadata/detail-notes.ts`, `Product.detailNotes`,
   migration `0008_add_product_detail_notes`). Lazy, cached, category-grounded
   (uses the retailer's **confirmed** category, not an AI guess) extraction of the
   visually critical specifics (weave/technique, motifs, border, embellishment,
   texture); threaded into `buildViewPrompt` so the model is told what to
   preserve. One-time Flash-lite call per product. Notes are **per-view**: front
   notes → front prompts, back notes (`Product.backDetailNotes`, migration `0009`)
   → the catalogue back-view prompt only (quick-listing is front-only, so it never
   sees back detail). Wired into both the objective engine and the legacy path.
4. **Prompt enrichment v2 — category-first + detail close-ups (done).**
   - **Category-first:** the category selector is the first field and is required
     before image upload; it's passed to the extractor and asserted as ground
     truth so the model never reclassifies (e.g. saree → dupatta), not even in the
     title. Removed the duplicate category control.
   - **Detail close-ups** (`lib/product/part-slots.ts`, `Product.partImages`,
     migration `0010`): optional, category-specific close-up slots (Saree →
     pallu/border/blouse; Lehenga → skirt/blouse/dupatta; Sharara similar; Men's
     Suit → trouser/waistcoat) rendered as a grid once a category + main image are
     chosen. **Extraction-only** — they enrich the front `detailNotes` (added as
     extra image parts to the one-time Flash extraction) but are **never** sent to
     the image generator, so generation token cost is unchanged.
   - **Input cap:** the real cap was the client-side resize at upload (800px,
     applied before both AI and storage — which also made the server preprocessing
     a no-op). Raised to **1280px @ q90**.
   - **Stepped upload flow:** the Add-Product page is now progressive — category
     (required) → image card (+ detail close-ups) → AI auto-fill status → generate
     toggle (objectives shown as two concise side-by-side cards) → always-visible
     metadata form → Add to Catalog. Gender/model pickers removed (gender comes
     from extraction; model auto-selected).

   **Near-future (requested, not built):** model picker (choose among a few base
   models); background options by colour/location; branding that blends subtly
   into the catalogue background rather than a hard logo overlay; surfacing the
   stored detail close-ups on the product detail/edit page.

**Optional back product image (Phase H, done).** `Product.backImageUrl` (nullable,
migration `0004`) — an optional second image uploaded in the product form. The
current flow is unchanged when it's absent. When present, the catalogue **back**
base shot is generated from the real back image (Gemini: back image as the
product; Vertex: back image as the garment) instead of the model inventing the
back — meaningfully more precise for kurtis, blouses, etc. Front views and Quick
Listing are unaffected.

**Try-on improvement research (recommendation only — not built):** today try-on
uses only `product.imageUrl`. Highest-payoff additive wins, in order: (1) pass the
generated **on-model image** (`modelImageUrl`) as the garment reference for
drape-heavy categories; (2) feed catalogue **metadata** (material/occasion/
subcategory) into the Gemini try-on prompt (Vertex is image-only); (3) multi-
reference (front+back) once catalogue multi-view exists. Schedule separately.

## 12. Scenic Collection (contextual scenes)

**Principle.** The backdrop chooser is now two peer sections: **Studio** (the
existing flat backdrop presets, §11's `backdrops.ts`/`backdrop-match.ts`,
unchanged) and **Scenic Collection** — the product placed in a designed,
contextual environment (Wedding, Diwali, Boutique, Editorial, …) while the
garment stays the unambiguous hero. Both sections are peers producing the same
`backdrop: string` prompt fragment consumed by `prompt-sets.ts#buildViewPrompt`
— the engine branches on which section a retailer has selected, but nothing
downstream (prompt assembly, branding, persistence) needs to know which one
ran. Feature-flagged `ENABLE_SCENIC_COLLECTION` (off by default — the Studio
path is unchanged either way).

**Scene Library architecture** (`lib/model-gen/scenes/`) — structured
definitions, not prose, exactly mirroring `backdrops.ts`'s pattern:
- `types.ts` — `Scene` (id, brandPack, variationPolicy, cameraStyles, palette,
  variations, brandingHint, negativeExtras, recommendFor), `SceneVariation`
  (environment + `DepthLayers` foreground/midground/background + decor lists
  per density), `SceneIntensity` (minimal/balanced/editorial — how prominent
  the environment reads), `SceneDensity` (minimal/classic/rich — how many
  environmental elements appear), `CameraStyle` (morning/golden-hour/
  soft-daylight/evening/night/indoor-studio/outdoor).
- `library.ts` — `SCENES: Scene[]`, the launch content. **Adding a scene is
  pure data, zero code changes** — see the recipe/template in that file's
  header comment. This is the entire point of the pattern.
- `rule-engine.ts` — `selectSceneVariation` (deterministic pick of one curated
  variation per product, stable hash of category/color/pattern — same product
  always renders the same variation; different products spread across the
  pool) and `recommendScenes` (deterministic occasion/styleTag/season → scene
  affinity, mirrors `lib/providers/auto-routing.ts`'s table-driven category
  routing — e.g. a Bridal-tagged product surfaces "Suggested: Wedding", not
  Corporate).
- `color-harmony.ts` — `resolvePaletteAccent` reuses `getColorCompatibility`
  from `lib/matching-engine/color-harmony` (the same core IP `backdrop-match.ts`
  already reuses) to pick the scene's best-fit accent colour for the garment,
  steering away from tonal clashes (e.g. a deep-red bridal outfit won't get a
  red-dominated Wedding accent).
- `prompt-builder.ts` — `renderScenePrompt` composes environment + depth +
  camera style + intensity-scaled prominence language + density-gated decor +
  the resolved palette accent + the negative clause into ONE deterministic
  fragment. Pure, no AI call — same contract as `renderBackdropPrompt`.
- `negative-prompts.ts` — first-class, reusable **Negative Prompt Library**
  (`CORE_NEGATIVE_CONSTRAINTS` + optional per-scene `negativeExtras`). Gemini's
  `generateContent` has no separate negative-prompt parameter, so this is
  prose appended to the same single request — zero extra cost.
- `selection.ts` — `ScenicSelection` (sceneId/intensity/density) + parse/
  validate, mirrors `backdrops.ts`'s `BackdropSelection`.

**Save vs Variation.** `Scene.variationPolicy` is explicit per scene:
`"varies"` (Wedding/Diwali/Eid/Summer/Winter — 4-5 curated environments,
rule-engine picks one deterministically per product) vs `"consistent"`
(Boutique/Editorial/Corporate — exactly one curated layout, always). The UI
hides the Density control entirely for `"consistent"` scenes — there's nothing
to vary.

**Storage (decisions, all additive):**
- `User.aiGenSettings` (existing nullable JSON column) gains `backdropSection:
  "studio" | "scenic"` (default `"studio"`) and `scenic: ScenicSelection`.
  Zero migration — same "one column, no churn" pattern as the rest of
  `AiGenSettings`. Missing keys on old stored JSON parse to the Studio default,
  fully backward compatible.
- `GenerationRecord` gains nullable `sceneId` / `sceneIntensity` / `sceneDensity`
  columns (migration `20260705213521_add_scene_tracking_to_generation_record`)
  — additive, no FK, same durable-analytics-snapshot rationale as the rest of
  that table. Null for Studio-path generations. This is the queryable store a
  future data-driven scene recommender (see below) would read from, mirroring
  the existing "data-driven Auto routing" note in §8.

**UI** (`components/product/SceneModeSelect.tsx` + `ScenicCollectionSelect.tsx`):
top-level Studio/Scenic Collection segmented chips (same visual language as
`BackdropSelect`'s existing chips); Scenic Collection groups scenes into
horizontally-scrollable **Brand Pack** rows (Festive/Nature/Boutique/Editorial/
Corporate) so 8+ scenes stay compact; each scene is a CSS-gradient preview tile
(no image assets, zero cost — same technique as `BackdropSelect`'s
`StudioPreview`); the top `recommendScenes()` pick(s) get a lightweight
"Suggested" tag. Selecting a scene reveals Intensity (always) and Density (only
for `"varies"` scenes) as 3-segment controls. No dropdowns.

**Cost philosophy — zero additional AI calls.** Scene resolution (variation
pick, colour-harmony accent, prompt composition) is 100% deterministic, exactly
like Smart Match backdrop scoring. Still one Gemini call per view either way.

**Launch content (8 scenes, 5 Brand Packs):** Wedding, Diwali, Eid (Festive) ·
Summer, Winter (Nature) · Boutique (Boutique) · Editorial (Editorial) ·
Corporate (Corporate). Chosen to prove both `"varies"` and `"consistent"`
scene categories end-to-end.

**Future scene roster (documented, not yet authored).** Naming one of these
to a future session, with the recipe in `library.ts`'s header comment, is
enough context to author it with no other architecture changes:

| Scene | Proposed Brand Pack |
|---|---|
| Luxury Store | boutique |
| Resort | nature |
| Café | boutique |
| Street Fashion | editorial |
| Office | corporate |
| Runway | editorial |
| Heritage Architecture | festive |
| Beach | nature |
| Temple | festive |
| Garden | nature |
| Studio Interior | boutique |

**Scene Preview.** Static/CSS-rendered for launch (no Gemini calls, no cost) —
satisfies "generate once, reuse" trivially since there's nothing to generate.
Real photographed/AI-generated scene previews are a deferred, explicitly
out-of-runtime-path future step: a one-time batch job per scene × variation,
stored permanently (Cloudinary), never generated at request time.

**Future extensibility (recorded here as chosen alternatives, not built):**
- **Retailer-specific scene libraries** — per-retailer custom scene sets,
  additive to the shared `SCENES` array (a `RetailerScene` table keyed by
  user, surfaced alongside the shared library).
- **Saved custom scenes** — a retailer composes and names their own
  Scene/variation combination for reuse across products.
- **Campaign templates / marketplace-specific presets / seasonal collections**
  — bundles of scene + intensity + density + branding presets for a
  time-boxed campaign, orthogonal to the per-generation chooser.
- **Provider-specific scene optimization** — if a second image-gen provider
  is ever added to the model-gen axis (§3 currently keeps it Gemini-only), the
  Prompt Builder can gain a provider-aware rendering branch without touching
  `Scene` data.
- **AI-assisted scene recommendations** — once `GenerationRecord.sceneId` has
  volume, `recommendScenes`' deterministic table can be supplemented (never
  replaced) with observed performance data, exactly like the Task 4 →
  data-driven-Auto-routing path already planned for try-on (§8).
- **Custom retailer identity packs** — a Brand Pack scoped to one retailer's
  own house style (their store's real interiors/props), sitting alongside the
  shared Festive/Nature/Boutique/Editorial/Corporate packs.
- **User-selectable camera style** — `Scene.cameraStyles` already lists every
  allowed option per scene (index 0 = default); a picker in
  `ScenicCollectionSelect.tsx` is a small additive UI change whenever it's
  wanted, no data model change.

### Future extensibility (recorded here as chosen alternatives)
- **Reference asset hosting → Cloudinary.** v1 is bundled-static for speed/cost/
  determinism. Cloudinary-hosting (CDN, transforms, consistent with product/model
  images) is the natural next step when the asset set grows or needs CMS-style
  management — store URLs in the same config map; the loader gains a URL fetch
  branch alongside the filesystem read.
- **Per-retailer custom reference models.** Let retailers upload their own house
  model(s) into a DB-backed library (a `ReferenceModel` table keyed by user +
  variant), surfaced in the store-model picker. Additive to the current static set.
- **Category-specific prompt sets → admin-configurable / RAG.** `prompt-sets.ts` is
  data-shaped; promote to per-retailer config, then RAG-driven prompts seeded by
  the research log (§8).
- **Model-gen research-log labels.** Quick Listing currently reuses
  `generateTryOnVertex` (logs as `tryon-vertex`, Cloudinary `tryon-vertex/`). When
  the learning loop matures, add a dedicated `model-vertex` log type + folder so
  model-gen and try-on corpora are cleanly separable.
