# Home Material Intelligence Platform — Domain Docs Index

**This is the anchor doc for the Home Material Intelligence domain
(walls: paint/wallpaper/wall-texture/wall-panels, India-first) — a
separate product from the rest of Product Match.** Whenever asked to
"refer to," "read," or "check" this domain's architecture, plan, or
docs — with no more specific pointer given — start here, then follow
whichever linked file below actually answers the question. This
sentence is the intended generic trigger; no more specific phrasing
should be needed (see the bottom of this file for how this convention
itself is recorded).

Status: **Full V1 core journey shipped end to end. V1 scope narrowed to
wallpaper-only on 2026-09-16** (paint/wall-texture/wall-panels deferred,
not removed — schema-compatible, zero migration needed to resume; see
`product/roadmap.md`'s "Material & surface expansion register"). The
wallpaper product schema v1 (description/materialComposition/colorFamily/
patternCategory/visualStyle/installationMethod/sampleAvailable,
`HmProductFamily`, `HmProductEvent`) shipped the same day, and the same
day the **internal wallpaper catalogue tool** shipped too (single-entry
add/edit/delete, PDF bulk import with a structured-extraction + human
review pipeline, a new below-admin `HM_CATALOGUE_MANAGER` role) — see
`architecture/system.md`'s "Internal catalogue tool" section. Sub-problems
B/E/G/A/C/F shipped, D permanently deferred. Mode A landing/browse
shipped 2026-09-10; rebuilt to match `/shop`'s browse UX ("browse-parity")
2026-09-14/15.

**Split from one monolithic file into this structure on 2026-09-10** (an
approved proposal from `research/home-material-ui-discovery.html`'s
discovery pass) — the original file had grown past 1,000 lines mixing
locked decisions, a shipped-feature changelog, and open questions into one
linear document. Nothing was deleted; every section below points to where
its content actually moved.

This product is a **separate domain** from the rest of Product Match (the
Indian ethnic-fashion retailer SaaS). It must not inherit fashion/garment
taxonomy, prompts, schemas, or business rules. It may share generic
infrastructure — see `domain/data-model.md`.

## Where things live

- **[`product/overview.md`](product/overview.md)** — product thesis, V1
  scope, locked naming/scope decisions, current priorities, open/deferred
  items. **Start here for "what is this and what's the current state."**
- **[`product/roadmap.md`](product/roadmap.md)** — the V1 → V2+ forward
  plan: the intent-first entry evolution (reviewed and approved
  2026-09-11), what's locked/proposed/deferred/rejected from that review,
  and the differentiation thesis behind it. **Start here for "what's next
  and why."**
- **[`domain/data-model.md`](domain/data-model.md)** — entity
  relationships, what's shared vs. domain-specific vs. fashion-protected.
- **[`ai/boundaries.md`](ai/boundaries.md)** — the locked AI-boundaries
  table (Constitution §15): which layer (CV / material knowledge /
  product DB / recommendation engine / visualization engine / LLM) owns
  what, and what it's explicitly not responsible for.
- **[`architecture/system.md`](architecture/system.md)** — locked
  technical decisions (auth pattern, schema location), local dev database
  isolation, known environment issues.
- **[`ui/decisions.md`](ui/decisions.md)** — the 2026-09-10 UI discovery
  outcomes (Mode A browse/landing merge, docs restructuring, reference
  downgrades, phase order) and a pointer to the full research document.
- **[`changelog.md`](changelog.md)** — the complete, dated, chronological
  history of what shipped, why, and how it was tested, from the
  2026-09-07 fast-lane pivot through the 2026-09-16 wallpaper-only
  narrowing. **Read this for "how did we get here" or to re-derive the
  reasoning behind any specific decision above.**

## Product thesis (short version — see `product/overview.md` for full)

> Make better material decisions before you spend money on your home.
> See it. Understand it. Compare it. Buy it.

Understand → Explore → Visualize → Compare → Validate → Decide → Source.

## Current direction (read this before picking up work)

- **V1 is wallpaper-only (2026-09-16).** Paint/wall-texture/wall-panel are
  deferred, not deleted — see `product/roadmap.md`'s expansion register
  for exactly what each needs to resume.
- **Known gap: the code doesn't fully match that narrowing yet.**
  `scripts/seed-home-material.ts` still seeds 4 paint products + 1 texture
  product alongside wallpaper, and the browse UI
  (`components/home-material/MaterialProductCard.tsx`'s `CATEGORY_ORDER`/
  `CATEGORY_LABELS`, used by `MaterialBrowseSection.tsx`'s category tabs)
  still hardcodes and displays all 4 categories. Nothing is broken by
  this — it just means today's demo catalogue and filter tabs are wider
  than the current scope. Resolve this (hide/remove the other 3 tabs,
  decide whether to keep or drop the non-wallpaper seed rows) as part of,
  or before, the upcoming wallpaper-catalogue feature work — see
  `product/roadmap.md`.
- Real-photo visualization quality is user-confirmed working.
- Multi-wall sub-problems B, E, G, A, C, F are all shipped; **D
  (panoramic/wide-angle) is permanently deferred** — do not build it
  without a new, explicit conversation reopening that decision.
- Full UI phase order (Mode A landing/browse → Discovery/Decision/
  Validation vocabulary → Sage Studio visual system → layout
  restructuring → Guide/Shortlist layout options → browse-parity rebuild)
  is shipped — see `ui/decisions.md`.
- **The internal wallpaper catalogue tool is shipped** (2026-09-16) — see
  `architecture/system.md`'s "Internal catalogue tool" section. Real
  curated `HmProduct` rows (single-entry or PDF bulk import) now go
  through it instead of editing `scripts/seed-home-material.ts` or using
  the old discreet test button (deleted). Next: actually use it to build
  out a real catalogue beyond the demo seed rows, and revisit the
  intent-first entry evolution below.
- The intent-first entry evolution (reviewed/approved 2026-09-11) remains
  the next strategic phase after the catalogue work — see
  `product/roadmap.md` for what's locked/proposed/deferred and
  `research/home-material-intent-first-review.html` for the full
  technical review.

## How to point a future session back here

Say something generic — e.g. "read/refer to the Home Material docs,"
"check the material-side architecture," "read all the wall-materials
plan docs" — no exact phrasing required. This file's opening paragraph
exists specifically to make any such generic request resolve here first,
then fan out to whichever linked file actually has the answer:
`product/overview.md` for current scope, `product/roadmap.md` for
what's next/deferred, `domain/data-model.md` for schema/entities,
`ai/boundaries.md` for which layer owns what, `architecture/system.md`
for technical/environment decisions, `ui/decisions.md` for UI history,
`changelog.md` for the full dated "how did we get here." This convention
is also recorded in memory (`home-material-intelligence-direction.md`)
so it survives even a session that hasn't read this file yet.
