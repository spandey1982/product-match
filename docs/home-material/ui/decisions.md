# Home Material Intelligence — UI Discovery & Decisions

Part of the domain-scoped docs split approved 2026-09-10 — see
`../README.md` for the index.

## The discovery document

Full research, evidence matrix, reference register, conflict analysis,
and proposed information/experience/interaction architecture live in
[`research/home-material-ui-discovery.html`](../../../research/home-material-ui-discovery.html)
(repo-root `research/`, matching the house style of this repo's other
research papers — see that folder's existing convention). Read that
document first before picking up UI work in a future session; this file
only records the decisions made against it.

## Decisions locked 2026-09-10

The discovery document's §27 posed 5 questions for review. Outcomes:

1. **Mode A entry point (standalone browse, no room upload required):
   APPROVED, build now.** Shipped same day — see "What shipped" below.
2. **Interactive homepage hypothesis: APPROVED, with a specific shape.**
   Not a separate marketing hero page plus a separate browse page — ONE
   merged screen. `/materials` itself is now the landing page AND the
   Mode A catalogue browse, communicating the product's core differentiator
   (see it on your own wall before buying) directly alongside real
   products, rather than routing a marketing hero to a second page.
3. **Docs restructuring (this split): APPROVED.** `docs/home-material/`
   is now organized into `product/`, `domain/`, `ai/`, `architecture/`,
   `ui/`, with the chronological shipped-feature history moved to
   `changelog.md`. Zero code impact.
4. **Rituals / Amazon Watch-and-Shop downgrade: APPROVED, with a stated
   balance.** Both stay downgraded from "adopt" to "investigate cautiously"
   per the discovery document's evidence review — but explicitly NOT
   reclassified as disproven or permanently rejected: absence of strong
   supporting evidence for a pattern is not evidence the pattern would
   fail for this product. Revisit either if a stronger source surfaces.
5. **Proposed phase order (Mode A gap → Discovery vocabulary → Decision
   vocabulary → Validation flows → visual system): APPROVED as-is.**

## What shipped against decisions 1 and 2 (2026-09-10)

- `app/materials/page.tsx` rebuilt as the merged landing + Mode A browse
  page: hero section (value proposition, "Upload your room" primary CTA)
  directly above a public, unauthenticated, server-rendered product grid
  grouped by material category (paint/wallpaper/wall_texture/wall_panel),
  each card showing a real color/pattern swatch and honest pricing (exact
  retailer price vs. indicative range — same never-blend rule used
  elsewhere in this domain). Marked `export const dynamic = "force-dynamic"`
  since pricing must never serve a stale build-time snapshot.
- **"See in my room" deep link**: picking a product on the browse page
  carries its id through the entire unauthenticated → login → room-upload
  → room-creation chain (`?product=<id>` query param, preserved through
  the existing `returnTo` login redirect) and pre-selects that product in
  the swatch picker the moment the user confirms their first wall —
  closing the loop the discovery document flagged (Mode A previously had
  no home in the app; a user who already knew what they wanted had to
  re-find it after uploading).
- Browser-verified end to end (not just script-level): clicked "See in my
  room" on a real seeded product from `/materials`, uploaded a test photo,
  detected + confirmed a wall, and confirmed the product was pre-selected
  in the swatch carousel on the resulting surface.
