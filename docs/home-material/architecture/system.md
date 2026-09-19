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

## Internal catalogue tool (2026-09-12, superseded 2026-09-16)

No retailer onboarding flow exists yet (see `../product/overview.md`'s
"Not in V1" list) — the account owner curates the catalogue directly.
The original discreet `POST /api/home-material/products/admin-add` +
`components/home-material/AddTestProductButton.tsx` (a muted floating
button on `/materials`, added 2026-09-12) was **deleted 2026-09-16** and
replaced by a real internal admin section:

- **`/admin/home-material/products`** — list/add/edit/delete `HmProduct`
  rows covering the full field set (not just the handful the old test
  button had), gated by `canManageHmCatalogue` (`lib/auth.ts`).
- **`/admin/home-material/import`** — PDF bulk catalogue import. One PDF
  is expected to be one collection (matches how these arrive from
  suppliers). Extraction is structured, not OCR/AI vision:
  `lib/home-material/pdf-import.ts` reads the PDF's own text and embedded
  image objects via `pdfjs-dist` — in a typical catalogue PDF the brand
  logo/SKU/collection caption is a separate text layer drawn over the
  photo, not baked into its pixels, so this yields a clean product image
  and reliable caption text for free, deterministically, at zero AI cost.
  Each page is heuristically classified product/info/noise/ambiguous
  (never guessed when unsure — "ambiguous" is a first-class outcome) and
  staged as an `HmCatalogueImportPage` row; nothing becomes a real
  `HmProduct` until a human reviews and approves it at
  `/admin/home-material/import/[id]`.
- **`/admin/home-material/staff`** — ADMIN-only page to grant/revoke the
  new `HM_CATALOGUE_MANAGER` role (a `User.role` value alongside the
  existing `ADMIN`/`RETAILER`), so catalogue upkeep can be handed to
  someone else without giving them full admin access (wallets, pricing,
  orders, etc. stay ADMIN-only). A catalogue manager can never reach this
  page themselves — `canManageHmCatalogue` gates the other two pages,
  plain `isAdmin` gates this one.

Both single-entry and PDF-approved products always start as
`HmProduct.reviewStatus: "draft"` (invisible on `/materials`) until
explicitly published — a schema field added the same day, default
`"published"` so every pre-existing row keeps its current visibility
unchanged.

## PDF worker path under Turbopack (found + fixed 2026-09-16)

`pdfjs-dist`'s Node fallback ("fake worker", since there's no real
`Worker` thread server-side) dynamically `import()`s its own worker
bundle relative to itself. Under Next's Turbopack (dev and build),
`pdf.mjs` gets relocated into a chunk directory that relative lookup
can't resolve (`Cannot find module '.../pdf.worker.mjs'`) — reproduced
live, not just a theoretical concern. `require.resolve()`/
`createRequire()` don't work around it either: Turbopack rewrites even
those calls to a synthetic virtual-module path instead of a real
filesystem one. The fix in `lib/home-material/pdf-import.ts`: set
`pdfjsLib.GlobalWorkerOptions.workerSrc` to a plain string path built
from `process.cwd()` — never analyzed as a module specifier, so
Turbopack leaves it alone. Verified against a live Turbopack dev server
end to end (upload → extract → review → approve → real product with a
correctly-uploaded Cloudinary image). Worth remembering if any other
future feature reaches for `pdfjs-dist` or a similar package with its
own internal dynamic worker/asset loading.

## PDF extraction rework — real supplier PDF exposed 3 real bugs (2026-09-16, same day as the tool's first ship)

The tool's first version was validated only against a hand-built synthetic
test PDF (one image per page, plain JPEG). The very first real supplier
file tried against it — a genuine wallpaper catalogue PDF — surfaced
problems the synthetic test couldn't: a 29-minute run that finished with
**zero usable product photos** (10 pages, all landed as "ambiguous", none
had an image). Root-caused by opening the same file directly against
`lib/home-material/pdf-import.ts` outside the app (fast to iterate, no
server needed):

1. **JPEG2000 (JPX) images failed to decode.** Real catalogue PDFs
   commonly use JPX compression; `pdfjs-dist` needs an OpenJPEG wasm/JS
   decoder to read it, and without an explicit `wasmUrl` this fails
   outright in Node (`"Cannot find package
   'nullopenjpeg_nowasm_fallback.js'"` — a null-concatenation bug upstream
   when the option isn't set) — every JPX image on the page silently
   failed. **Fix:** `wasmUrl` set to the real on-disk `pdfjs-dist/wasm/`
   directory (same `process.cwd()`-based, Turbopack-safe pattern as the
   worker-path fix above). Verified: 0 decode failures across a real
   53-image JPX-heavy page, vs. every JPX image failing before.
2. **"One page = one product" was the wrong shape for a real catalogue.**
   The same real page had **14 real product photos** on it alongside ~40
   tiny logo/icon/bullet images (also JPX-encoded, which is why bug 1
   masked this one too). The original "exactly one image on the page"
   classifier would have misclassified this page as "ambiguous" even with
   JPX fixed. **Fix:** classification granularity moved from "one page,
   one candidate" to "one candidate per qualifying image" — every
   embedded image at least `MIN_PRODUCT_IMAGE_DIM` (150px) on a side
   becomes its own product candidate, all tagged with their source page;
   smaller images are silently treated as decorative, not lost data. A
   page can now yield zero (info/noise), one, or dozens of candidates.
   `guessName`/`guessSku` still run once per page (from the page's full
   text) and the same guess seeds every candidate from that page — a
   starting hint only, not a precision claim, since a busy multi-product
   page can't be reliably auto-captioned per-image without real layout/
   position matching (not built — see "Not built" below).
3. **Resolving many images in parallel made real, decodable images time
   out.** First fix attempt resolved every image on a page concurrently
   (`Promise.all`) to avoid the old sequential-timeout pile-up. This
   actually made things worse: `pdfjs-dist`'s Node "fake worker" isn't
   real parallelism (same single-threaded decode queue either way), so
   firing 50+ requests at once made genuinely-decodable images spuriously
   time out waiting their turn behind everything else queued at the same
   moment — confirmed on the same real page (parallel: ~45 false
   "ambiguous" results; sequential: the correct handful, 0 false
   failures). **Fix:** reverted to resolving one image at a time with a
   generous 8s-per-image timeout — correct AND fast in the common case
   (each image decodes in well under a second once JPX/wasmUrl is fixed),
   and a slow/failing page only costs that page's own processing time,
   not the whole import, because of the next change:

**Processing moved from one blocking call to page-by-page with live
progress + abort** (direct user feedback: a real file made the whole
"Upload & Extract" button sit with zero feedback for many minutes, with
no way to tell if it was working or stuck, and no way to stop it). `POST
/api/admin/home-material/catalogue-imports` now only opens the PDF (fast —
parses structure, decodes nothing) and returns immediately with the page
count; the client (`ImportView.tsx`) then calls `POST .../[id]/
process-next` in a loop, one PDF page per call, showing "page X of Y" and
a progress bar between each. `POST .../[id]/cancel` stops the loop (with
a confirmation dialog on real page counts already scanned) — everything
extracted before the stop stays as real, reviewable
`HmCatalogueImportPage` rows; `HmCatalogueImport.status` gains a
`"cancelled"` value alongside processing/needs_review/completed/failed.

**Tried and reverted: persisting the raw PDF for cross-request resume.**
The chunked design first stored the uploaded PDF in Cloudinary
(`sourceFileUrl`) so a `process-next` call could re-open extraction from
scratch if the in-memory session was evicted or the server restarted.
This failed immediately on the very same real test file: Cloudinary's
account plan caps raw uploads at 10MB, and the file is 19.4MB —
`uploader.upload_large`'s chunking only chunks the HTTP transport, not
the account's asset-size limit, so it hit the identical cap. Reverted:
the raw PDF is never persisted; `lib/home-material/pdf-import-sessions.ts`
holds the open session in memory only for the lifetime of one processing
run. If the server restarts mid-import, `process-next` fails with a clear
"re-upload" message (410) instead of silently reprocessing — pages
already extracted stay valid. Acceptable for a single-sitting internal
tool; revisit only if imports start regularly spanning a server restart.

**Products can no longer publish without a photo** (direct user question:
"do you think it's advisable to release the product without a product
image?" — no). `lib/home-material/product-form.ts`'s
`requiresImageBeforePublish` blocks `reviewStatus: "published"` at both
product routes (POST create, PATCH edit) unless a real image exists or is
being uploaded in the same request. A draft with no photo is still
allowed — a legitimate "still need this photo" placeholder — and is
visually flagged in the product list (`ImageOff` icon + "No photo" label)
so it isn't forgotten. Bulk-import approval already forced `"draft"`
regardless of form input, so this mainly matters for the single-entry
form and for actually publishing an approved draft later.

**Not built** (real gaps, not attempted this pass): per-image caption/
position matching for a multi-product page (would need tracking each
image's page-space bounding box through the operator list's transform/
save/restore stack and pairing it with nearby text runs by proximity —
real, achievable, but risky to get subtly wrong without a way to visually
verify the geometry, so deferred rather than shipped unvalidated); a
review-queue bulk action ("approve all", "reject all remaining on this
page") — with a real PDF now capable of producing 100+ candidates in one
import, an admin working through them one at a time is a real, known
friction point, just not what this pass's feedback was about.

## AI classification + enrichment pass (2026-09-17, the "hybrid" follow-up)

After the extraction rework above, the owner reviewed real pages from 4
different real supplier PDFs (Palm Island, Feather Touch, Wall Craft,
Signature Walls — sampled by rendering pages with `@napi-rs/canvas`, not
just reading text) and laid out five recurring image roles a catalogue
page mixes together: a clean flat tile (the one that matters), a
lifestyle/room photo, a texture/surface close-up, a multi-product group
shot (folded rolls, or a small colourway-swatch grid), and outright noise
(cover art, decorative graphics). Pure size/position heuristics can't
tell these apart — approved building a Gemini vision pass on top of the
existing deterministic extraction, never replacing it, same "propose,
never decide" boundary as `wall-detection.ts`.

**Shipped:**
- `lib/home-material/pdf-classification.ts` — one Gemini vision call per
  PDF page (batched across all of that page's candidate images, up to 8
  per call — NOT one call per image, which would multiply an already-slow
  import), classifying each into clean_tile/lifestyle/texture_closeup/
  group_shot/noise plus a finish guess and colour hint when confident.
  Result stored on `HmCatalogueImportPage.aiClassification`, purely
  additive to the deterministic `pageType` — a "noise"-classified
  candidate stays fully visible and reachable in review, never hidden
  (explicit instruction: never miss a real product). The review queue
  (`ReviewQueueView.tsx`) shows a role badge, sorts clean_tile candidates
  to the top, and pre-fills the form's colour/finish fields from the
  hints.
- `lib/home-material/collection-info-extraction.ts` +
  `collection-info-runner.ts` — a second, TEXT-ONLY Gemini call, run once
  per import (not per page) over every page whose text reads like
  collection-level reference material (material composition, install
  method, warranty, eco claims) rather than one specific product —
  gathers `pageType: "info"` pages AND any page the vision pass called
  "noise" (a real find: a genuine material/tech page can carry a small
  diagram that makes the deterministic classifier tag the whole page
  "product," even though it's not one). Result on `HmCatalogueImport.
  collectionFields`, surfaced as a panel in the review queue with a
  per-card "Fill from collection info" button — never auto-applied.
- A "copy shared fields from last approved" button per card, tracking
  which `ProductFormValues` fields genuinely tend to be shared across
  colourway siblings (finish, material composition, pattern
  category/name, installation method, sheet dimensions, price — never
  name/SKU/colour, which are exactly what's supposed to differ) —
  directly the "shiny/matte/glossy applies to all of that kind" workflow
  described in the request. A code-prefix badge (`101` from `101/2`) is
  shown as an informational grouping hint alongside it; `HmProductFamily`
  itself stays MANUAL-only per its existing doc comment, untouched by
  this.
- Expanded the product-code regex: sampling the 4 real files found NONE
  of them use a leading-letter code like the original synthetic test's
  "WP-1234" — real codes were bare `NNN/N` or `NNN-N` (`101/2`, `203-3`)
  or labelled "Pattern No.:850/1" rather than "SKU:". The bare-numeric
  pattern is now tried before the alphanumeric one, not after.
- Raised `MAX_PDF_SIZE` from 30MB to 150MB — one real sample file (Wall
  Craft, 71 pages of full-bleed art) is 84MB, already over the original
  cap. Safe to raise freely now that the raw PDF is never persisted (see
  above), so this only bounds one in-memory `Buffer`.

**A real, separate bug found and fixed via this live testing (not new
this session, pre-existing in the chunked-processing work above):**
`lib/home-material/pdf-import-sessions.ts`'s in-memory session cache used
a plain top-level `const sessions = new Map()`. It worked the first time,
then started failing every lookup ("session no longer available") after
this file and its two importing routes were edited across several rounds
within the same running `next dev` process — Turbopack's incremental dev
compilation can hand two route files that both `import` the same module
two genuinely different instances of it, if they were compiled at
different points in the session. Fixed with the exact same `globalThis`
caching pattern `lib/db.ts` already uses for the Prisma client, for the
same reason. Worth remembering for any future module-level singleton
introduced in this app: use the `globalThis` pattern from the start,
don't wait to hit this.

**Cost, for real visibility:** both new calls log to `AiUsageEvent` under
`hm_catalogue_pdf_classify` / `hm_catalogue_collection_info` (no billing/
wallet interaction — internal tool, cost-tracking only, same posture as
`hm_wall_detection`/`hm_overview`). Observed per-page classification cost
on real pages: roughly $0.0003–$0.0017 (gemini-2.5-flash, batched).

**Live-tested against real files, not just the synthetic one:** page 1 of
Palm Island (14 real candidates) classified sensibly by eye — texture
close-ups, clean tiles, a group shot, lifestyle photos, and two "noise"
graphics all matched what the page actually shows; finish/colour hints
("embossed", "gold and beige") correctly pre-filled the review form.
Collection-info extraction verified correct end-to-end on the synthetic
PDF's real warranty text. **Real, disclosed limitation found on Wall
Craft's actual "Green Technology" page:** its explanatory paragraph text
isn't real PDF text at all (`getTextContent()` returns empty for that
page) — it's flattened into the page's artwork, so no amount of text
extraction can reach it; would need a page-level vision-transcription
fallback to capture, not built this pass.

**Not built** (flagged, not attempted): per-image bounding-box/caption
matching remains deferred (same reason as the extraction rework above);
page-level vision transcription for info pages whose text is rasterized
rather than real PDF text objects (the Wall Craft finding just above).

## Known environment issue — Gemini prepaid credits depleted (found 2026-09-12, unresolved)

While testing the new visualization cache (below), a live generation call
against the local `.env`'s `GEMINI_API_KEY` failed with `HTTP 429
RESOURCE_EXHAUSTED: "Your prepayment credits are depleted."` — confirmed
via the `AiUsageEvent` row (`estimatedCostUsd: 0`, so the failed attempt
itself cost nothing). **This env var is shared across the whole app**
(fashion-side model generation, catalogue motion, garment intelligence,
and every Home Material AI call all read the same `GEMINI_API_KEY`) — if
production's Railway environment points at the same AI Studio project,
**all AI image generation across both domains would currently be failing
for real users too**, not just this local test. Not yet confirmed against
production; needs the account owner to check AI Studio billing
(https://ai.studio/projects) and, separately, confirm whether Railway's
production `GEMINI_API_KEY` is the same key or a different one.

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
