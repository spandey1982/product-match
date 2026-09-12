# Home Material Intelligence — System Architecture

Part of the domain-scoped docs split approved 2026-09-10 — see
`../README.md` for the index.

## Locked technical decisions (2026-09-07)

| Decision | Choice | Why |
|---|---|---|
| Auth mechanism | Reuse the OTP-over-cookie *pattern* (`lib/customer-auth.ts`), new cookie names, no DB table for pending OTP | Proven, stateless, cheap; the pattern is generic infra even though the identity table isn't |
| Schema location | New models appended to the existing `prisma/schema.prisma`, `hm_` table prefix | Matches how this repo already holds many unrelated domains in one schema file; avoids the overhead of a second datasource for no real benefit at this scale |

See `../product/overview.md` for the paired product/naming decisions
(consumer identity, retailer model, top-level route).

## OTP gate temporarily removed (2026-09-12)

**Every route that required a real session now auto-provisions a guest
`HmUser` instead of returning 401.** `lib/home-material/auth.ts`'s new
`getOrCreateHmUserSession()` — no session cookie present transparently
creates a real `HmUser` row with a synthetic, never-dialled phone
(`guest_<uuid>`, impossible to collide with or be mistaken for a real
verified number) and a normal session cookie. Every route that used to
call `getHmUserSession()` + `if (!session) 401` now calls this instead.
Ownership checks (`project.hmUserId === session.id`) are untouched —
cross-user isolation still works exactly as before; only the login
requirement itself is gone.

**This is explicitly temporary**, not a reversal of the auth pattern
above. Per the intent-first entry review
(`research/home-material-intent-first-review.html`), the target design
moves the real OTP gate to immediately before generation rather than
before room upload — that redesign is deferred until explicitly
requested. To reinstate the current (pre-2026-09-12) behavior, revert
each call site from `getOrCreateHmUserSession()` back to
`getHmUserSession()` + the 401 check — `lib/home-material/auth.ts`'s
`getOrCreateHmUserSession` doc comment lists every affected file.

## Temporary shared trial catalogue (2026-09-13)

**"Upload your own wallpaper/paint photo" (`app/api/home-material/products/upload/route.ts`) creates a PUBLIC product for now, not a private one.** At the user's explicit request — before any real retailer-onboarding exists — anyone using the deployed app who uploads a trial wallpaper/veneer/paint photo through this existing customer-facing flow makes it visible to everyone (`uploadedByHmUserId: null`, same visibility as the curated demo catalogue), rather than private to just that uploader. `RoomView.tsx`'s upload panel discloses this plainly. This needed a real fix alongside it: the upload flow never linked an `HmMaterial`, so an uploaded product had no category and silently never appeared on the `/materials` browse grid (which only renders the 4 known categories) even though it worked fine in a room's own swatch carousel — a material-type dropdown is now required on upload, and the browse grid's card now shows the actual uploaded photo (`textureAssetUrl`) instead of a flat placeholder colour swatch.

**Revert** by restoring `uploadedByHmUserId: session.id` in that route once a real retailer/admin-onboarding flow exists — the route's own doc comment says exactly what to change back. This is a different, additive mechanism from the internal test-catalogue tool below — that one stays as the discreet, always-public developer tool; this one is the ordinary, customer-facing upload path, temporarily made public too.

## Internal test-catalogue tool (2026-09-12)

No retailer onboarding flow exists yet (see `../product/overview.md`'s
"Not in V1" list), so `POST /api/home-material/products/admin-add` +
`components/home-material/AddTestProductButton.tsx` (mounted once in
`app/materials/layout.tsx`) let a developer add a real, PUBLIC demo
product to the catalogue directly from the running app, without editing
`scripts/seed-home-material.ts`. Deliberately discreet (a small, muted,
off-brand floating button, bottom-right) — never linked from any
customer-facing navigation, not a retailer-facing flow.

## Known environment issue (pre-existing, not caused by this work — resolved)

Local dev Postgres had migration-history drift from `prisma/schema.prisma`:
one genuinely stuck failed migration plus 12 migrations whose schema effects
were already present in the DB but never recorded (likely applied via
`db push` at some point), all reconciled via `prisma migrate resolve`
without touching any data (2026-09-07). Separately, 4 orphan entries from an
abandoned local branch (`rnd/image-pipeline-benchmarks`) remain harmlessly
in `product_match_dev`'s `_prisma_migrations` table — dead bookkeeping, no
live table, left alone.

## Local database isolation (locked, 2026-09-07)

**This branch (originally `feature/home-material-intelligence`, now
`feature/home-material-knowledge`) uses its own local database,
`product_match_dev_hm`, not the shared `product_match_dev`.**

Why: while generating the `hm_*` migration, `prisma migrate dev` detected
that the shared dev database already had columns from a *different*,
unmerged, actively-developed branch (`feature/ai-catalogue-motion`, motion
job/QA fields for the ad-reel deliverable) that don't exist in `main`'s
`schema.prisma`. Multiple branches apparently share one local dev database,
so whichever branch you're on can find the DB "ahead" of its own schema.
Since this domain's new tables have zero existing data to lose, giving it
an isolated DB was strictly cheaper than reconciling with someone else's
in-flight work.

**Practical effect:** `.env`'s `DATABASE_URL` currently points at
`product_match_dev_hm` (not tracked by git — this is a local machine
setting). **Switch it back to `product_match_dev` when working on any other
branch**, or you'll be looking at an empty/different database. The new DB
was seeded by replaying the full existing migration history from scratch —
it has no product/retailer/user data of its own yet.
