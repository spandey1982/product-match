# Image AI — Architecture, Decisions & Roadmap

> **Living document.** This is the single source of truth for the virtual try-on
> and model-image-generation work. If a chat is lost, point Claude here first.
> Update it whenever a decision is made or a task lands.
>
> Last updated: 2026-06-14

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

**Model-gen** (untouched by the provider work)
- `lib/generate-model-image.ts` — `generateModelImage(productId)`, Gemini `nano-banana-pro-preview`. Writes `products.modelImageUrl`. Triggered from upload flow + `app/api/products/[id]/generate-model-image`.

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
```
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
| Model-image gen impl | `lib/generate-model-image.ts` |
| Try-on routes | `app/api/products/[id]/{tryon,tryon-vertex}/route.ts` |
| Admin provider setting | `app/api/settings/tryon-provider/route.ts`, `app/(dashboard)/settings/` |
| Research log (learning seed) | `lib/research-log.ts`, `logs/tryon-research.jsonl` |
| Setup guide | `docs/VERTEX_TRYON_SETUP.md` |
