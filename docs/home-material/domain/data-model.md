# Home Material Intelligence — Domain Data Model

Part of the domain-scoped docs split approved 2026-09-10 — see
`../README.md` for the index.

## Entity relationships (V1 draft — see `prisma/schema.prisma`, `hm_`-prefixed models)

`HmUser` → `HmProject` → `HmRoom` → `HmSurface` → (`HmMaterial` and/or
`HmProduct`) → `HmVisualization` → `HmRecommendation` → `HmShortlist` →
`HmRetailer`/`HmRetailerProduct` → `HmLead`. Provenance is first-class via
`HmProductEvidence` (one row per fact per product, with `sourceType` —
manufacturer/retailer/user/platform/ai_inferred/external_verified/
unspecified) — not retrofitted later. `HmSurface` carries an explicit
`measurementSource` (`ai_estimated` | `user_confirmed` | `professional`) so
a convincing estimate is never silently treated as a measurement (§11,
Constitution Principle 6).

Comparison and Shortlist are collapsed into one `HmShortlist` table for V1
(simplification proposed during discovery, not yet contradicted by real
usage data — revisit if/when the two need to diverge).

## What's shared vs. domain-specific

**Shared (generic infra, reuse as-is):**
`lib/db.ts` (single Prisma client), `lib/serialize.ts`'s `serializeArray`/
`parseArray` primitives (not `deserializeProduct`/`deserializeRecommendation`
— those are hardcoded to the fashion `Product` shape), Cloudinary client,
pg-boss/worker queue infra, `components/ui` primitives, the `AiUsageEvent`
cost ledger (new `feature` values, e.g. `"hm_visualization"`,
`"hm_room_analysis"` — the column is already free-text), admin `TaskItem`
backlog.

**Not shared (fashion-domain IP, never touched or imported by this domain):**
`lib/matching-engine/*` (protected — CLAUDE.md §4), `lib/garment-intelligence/*`,
`lib/fashion-designer/*`, `lib/model-gen/*`, `lib/catalogue-motion/*`, the
`Product`/`Recommendation`/`ShopOrder`/`RentalOrder`/`Customer`/
`ClientProfile`/`User` models and their business logic.

**Architecturally inspired by, but independently implemented:**
- Deterministic scorer + explainer split (`lib/matching-engine/scorer.ts` +
  `explainer.ts`) → this domain's own recommendation engine
  (`lib/home-material/recommendation.ts` +
  `lib/home-material/combination-recommendation.ts`). No code reuse — the
  weights/rules are entirely different (material suitability, not garment
  cross-sell) and the fashion scorer is protected IP.
- "Structured JSON, not prose" + "absence is information, never invent it"
  (Garment Intelligence's hard-won lessons, see root `PROJECT_KNOWLEDGE.md`)
  → `lib/home-material/wall-detection.ts`'s CV output shape: structured
  JSON only (`responseMimeType: "application/json"`), and an explicit
  `wallVisible: false` rather than a guessed box when nothing clear is
  visible.
- Deterministic post-generation mask compositing (`lib/model-gen/erase.ts`)
  → `lib/home-material/visualization.ts` uses the same technique for
  guaranteeing "preserve the room" (Constitution Principle 2): don't trust
  the model to respect a mask boundary, composite the edit against the
  original afterward.
- `GuestTryOnUsage`'s device-scoped free-quota pattern → this domain's
  visualization usage limits (V1 needs a cost policy before shipping, same
  reason the AI-usage ledger/wallet system exists for the fashion product).
