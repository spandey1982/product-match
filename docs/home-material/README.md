# Home Material Intelligence Platform — Domain Docs Index

Status: **Full V1 core journey shipped, sub-problems B/E/G/A/C/F shipped,
D permanently deferred, Mode A landing/browse shipped (2026-09-10).** This
is the anchor doc for this domain — read it first before re-deriving
architecture context in a future session (see CLAUDE.md §6), then follow
the links below for the detail you actually need.

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
  2026-09-07 fast-lane pivot through the 2026-09-10 sub-problem A/C/F
  work. **Read this for "how did we get here" or to re-derive the reasoning
  behind any specific decision above.**

## Product thesis (short version — see `product/overview.md` for full)

> Make better material decisions before you spend money on your home.
> See it. Understand it. Compare it. Buy it.

Understand → Explore → Visualize → Compare → Validate → Decide → Source.

## Current direction (read this before picking up work)

- Real-photo visualization quality is user-confirmed working.
- Multi-wall sub-problems B, E, G, A, C, F are all shipped; **D
  (panoramic/wide-angle) is permanently deferred** — do not build it
  without a new, explicit conversation reopening that decision.
- **UI visual polish** (the broader visual-design-system work, not the
  Mode A landing/browse merge, which is shipped) is next in the approved
  phase order — see `ui/decisions.md` and
  `research/home-material-ui-discovery.html`.
