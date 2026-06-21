# Image AI — Architecture, Decisions & Roadmap

> **Living document.** This is the single source of truth for the virtual try-on
> and model-image-generation work. If a chat is lost, point Claude here first.
> Update it whenever a decision is made or a task lands.
>
> Last updated: 2026-06-16

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
- Storage: Cloudinary. DB: SQLite (dev) / Postgres (prod) via Prisma 7.

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
| Front/back reference profiles | `lib/model-gen/reference-models.ts` (`loadReferenceImage(..., {profile})`) |
| Generation perf/quality records | `GenerationRecord` table, `lib/model-gen/generation-record.ts` |
| Model-gen strategies | `lib/model-gen/strategies/{quick-listing,catalogue}.ts` |
| AI-gen settings (storage accessor + API) | `lib/model-gen/settings.ts`, `app/api/settings/ai-generation/route.ts` |
| Store branding overlay | `lib/model-gen/branding.ts` |
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
upload/delete at `/api/settings/logo`); on/off + position (`top-left`/`top-right`,
default `top-right`) live in `aiGenSettings` (`brandingEnabled`, `brandingPosition`).
No-op when disabled or when there's no logo and no store name.

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

**Try-on improvement research (recommendation only — not built):** today try-on
uses only `product.imageUrl`. Highest-payoff additive wins, in order: (1) pass the
generated **on-model image** (`modelImageUrl`) as the garment reference for
drape-heavy categories; (2) feed catalogue **metadata** (material/occasion/
subcategory) into the Gemini try-on prompt (Vertex is image-only); (3) multi-
reference (front+back) once catalogue multi-view exists. Schedule separately.

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
