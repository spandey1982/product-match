# Home Material Intelligence — Product Overview

Part of the domain-scoped docs split approved 2026-09-10 (see
`../README.md` for the index and why this split happened). This file
holds the STATIC product-level reference material — thesis, V1 scope,
locked naming/scope decisions, and current priorities/open items. The
chronological "what shipped when and why" history lives in
`../changelog.md`.

## Product thesis

> Make better material decisions before you spend money on your home.
> See it. Understand it. Compare it. Buy it.

Understand → Explore → Visualize → Compare → Validate → Decide → Source.

Visualization is one capability, not the product. The long-term moat is
accumulated structured material/product/decision data, not any one AI
model — architecture should treat AI providers as replaceable.

## V1 scope (locked)

- **Surface**: walls only.
- **Materials**: paint, wallpaper, wall texture, wall panels.
- **Geography**: India-first; currency/units/terminology/retailer-discovery
  are config, not hardcoded into core domain logic.
- **Two customer modes**: "I know what I want" (product-accurate path) vs.
  "help me choose" (requirement-driven recommendation path).
- **Two visualization fidelities**: quick AI preview (exploratory, freer
  generative interpretation) vs. product-accurate preview (preserves real
  product colour/pattern/scale/repeat + everything else in the room).
- **Commerce model**: consumer-first experience + retailer catalogue/lead
  backend. Not a marketplace — no checkout/payment/logistics in V1.
- Not in V1: floors, tiles, kitchens, bathrooms, countertops, furniture,
  contractor/installer tooling, self-serve retailer onboarding.

## Locked product/naming decisions (2026-09-07)

| Decision | Choice | Why |
|---|---|---|
| Consumer identity | New dedicated table (`HmUser`), not `Customer` | Keeps domains separable per the "shared infra, not shared domain logic" rule; `Customer` carries fashion-commerce fields (tryOnCredits, ShopOrder/Wishlist relations) that don't belong here |
| Retailer side | New `HmRetailer` model, **admin-seeded only for V1** | No self-serve onboarding yet; mirrors how `ShopCollection` is admin-curated today; keeps the existing fashion `User` (retailer) model untouched |
| Top-level route | `/materials` | Scope-neutral — won't need renaming as Phase 2/3 add flooring, tiles, kitchens, etc. (unlike `/walls`, which is scoped to V1 and would force an SEO-costly rename later) |

See `../architecture/system.md` for the paired technical decisions (auth
mechanism, schema location) and local-environment setup.

## Current priorities (as of 2026-09-10)

1. ~~Multi-wall detection/selection~~ — discussion happened 2026-09-09,
   broken into sub-problems A–G. **B/E/G shipped 2026-09-09; A/C/F shipped
   2026-09-10; D permanently deferred** (user-confirmed). See
   `../changelog.md` for the full history and `../ai/boundaries.md` for
   the current-state summary.
2. **UI visual polish** — the full approved phase order (Mode A landing/
   browse -> Discovery-layer vocabulary -> Decision-layer vocabulary ->
   Validation-layer flows) is now shipped, see `../ui/decisions.md`. Only
   step 5, the visual design system, is now shipped too: "Sage Studio"
   (sage-green + Sora/Manrope, scoped to `.hm-theme` in
   `app/materials/layout.tsx`) applies across every `/materials/*`
   screen. Not yet built: a persistent top nav/logo header and button
   shape specifically (pill vs. boxy-rounded) — see `../ui/decisions.md`.
3. Real-photo visualization quality is user-confirmed working (manually
   verified against an actual room wall) — no longer an open gap.

## Open / deferred (not yet frozen)

- **Room-photo privacy policy** — flagged as a gap during discovery, not in
  the original brief. Needs an explicit principle (default-private, no
  retailer/marketing use without consent) before real room photos are
  collected from real users.
- **Minimum viable catalogue depth** for launch — not yet defined; both
  recommendation quality and product-accurate visualization are bottlenecked
  on real `HmProduct`/`HmRetailer` data existing.
- **Sub-problem D (panoramic/wide-angle)** — user explicitly confirmed
  2026-09-10 to keep this permanently deferred, not attempted. See
  `research/home-material-ui-discovery.html` for independent evidence
  (Roomvo/IKEA Kreativ both needed dedicated multi-photo CV investment for
  this) supporting the original call.
- **Full retailer-backed product-accurate tier** (real SKU + full
  provenance) — waits on actual retailer partnerships, not a coding task.
- **Mode A catalogue browse** — shipped 2026-09-10 as `/materials` itself
  (merged landing + browse), see `../ui/decisions.md`.
