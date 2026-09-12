# Home Material Intelligence — Roadmap (V1 → V2+)

This is the **single "what's done, what's next, why" reference** for this
domain — the complete arc from A to Z. `product/overview.md` holds the
static thesis/scope; `changelog.md` holds the dated history; this file
holds the forward-looking plan and the reasoning behind it. Read this
after `README.md`, before picking up any new work in this domain.

## Where V1 actually stands (2026-09-10)

The full brief §16 core journey is shipped end to end: Upload → AI wall
detection (polygon, multi-wall, drag-adjust) → Choose (swatch picker OR
help-me-choose recommendations) → Visualize (quick preview /
product-accurate, tagged) → Understand (material guide) → Compare/
Shortlist → Estimate → Request Quote/Sample → Retailer Lead. Multi-wall
sub-problems B/E/G/A/C/F are shipped; D (panoramic) is permanently
deferred. The full UI phase order (Mode A landing/browse → Discovery
vocabulary → Decision vocabulary → Validation flows → Sage Studio visual
system → layout restructuring to match it → Guide/Shortlist layout
options) is shipped. See `changelog.md` for the dated blow-by-blow.

**What V1 is, in one line:** a deterministic, explainable,
taxonomy-driven material advisor with real AI-generated visualization —
no free-text search, no embeddings, no behavioural personalization, no
persistent user profile beyond an OTP-authenticated identity.

## The V2 direction — intent-first entry (proposed 2026-09-11, reviewed and approved 2026-09-11)

On 2026-09-11 a large strategic proposal was brought for review: evolve
the entry experience around natural-language intent, precomputed product
intelligence, behavioural personalization, first-class "room trials," and
a revised OTP gate. **Full critical review:
[`research/home-material-intent-first-review.html`](../../../research/home-material-intent-first-review.html)**
(also published as a Claude Artifact — see the review doc's own header
for the link). Read that document for the complete reasoning; this
section is the operational summary.

### The differentiation thesis behind it (owner's words, recorded in full in the review doc's addendum)

> A time-saving, non-conventional experience that puts this product apart
> from every competitor — features can be copied by anyone, but
> experience originality can't be. The consumer should feel attended to
> like a customer-care agent in a physical store: they say what they're
> looking for, and the application does most of the remaining work,
> rather than requiring them to learn the product first. This is an
> explicitly accepted risk — there is no historical precedent or
> platform-scale data to de-risk it in advance.

This thesis is the reason the intent-first work is prioritized ahead of
some technically-adjacent items that would otherwise queue first. It does
**not** relax the cost/complexity discipline below — the owner explicitly
endorsed keeping that discipline exactly as reviewed.

### Review outcome — classified

Full reasoning for every row is in the review document. Condensed:

**Locked now** (cheap, reversible, ship without further discussion):
- ~~Server-side visualization cache/dedupe~~ — **shipped 2026-09-12**, see below.
- ~~"Room Trial" as the user-facing name~~ — **shipped 2026-09-12**, see below.
- OTP screen copy: "Create/save your room trial," never "enter your phone
  number." — **not yet done**, small follow-up left from the rename above.
- Sponsored-placement governance (never enters the ranking math, always
  labelled) — write this rule down now even before sponsorship is on the
  roadmap.
- "Based on what you've explored" reversible framing + one-click reset,
  wherever behavioural personalization eventually surfaces.

**Shipped 2026-09-12:**
- Mobile wall-vertex precision loupe (`RoomView.tsx`'s `DragLoupe`) — a
  2.5x magnified, finger-offset view of the room photo with a crosshair,
  shown only for touch/pen drags of a wall-outline vertex, never for
  mouse. Also fixed an unrelated mobile-only bug found alongside it: the
  confirmed-wall preview card's room photo could blow out past the card
  and the viewport on narrow screens (a `grid-template-columns: none`
  gap below the `lg` breakpoint let the image's intrinsic size set the
  track width) — fixed with an explicit `grid-cols-1` base. A second
  instance of the same root cause was later found on the `≥lg` desktop
  track itself (`lg:grid-cols-[1.15fr_1fr]` has no `minmax(0,...)` floor)
  — adding wallpapers/swatches grew the whole preview card horizontally
  instead of scrolling inside the swatch carousel; fixed the same way.
- **Server-side visualization cache/dedupe** — the single biggest locked
  cost win from the review, now actually built. `lib/home-material/
  visualization.ts`'s `computeVisualizationCacheKey` hashes every input
  that determines the generated pixels (room photo, wall outline/corners,
  product identity + its colour/finish/pattern/texture/sheet fields,
  resolved wall dimensions, adjacency offset); `HmVisualization` gained
  `cacheKey`/`version`/`savedAt`/`expiresAt` columns. `POST /api/
  home-material/visualizations` looks up a matching `status:"completed"`
  row for the same surface before calling Gemini at all — a hit returns
  the prior row verbatim (`{cached:true}`), skipping both the image-edit
  call(s) and the overview-QA call entirely. Verified via a zero-cost
  method (seeding a fake completed row with a hand-computed matching
  key, since the account's Gemini prepaid credits were depleted at the
  time — see the open-question note below): the API returned the seeded
  row's id/content and no new `AiUsageEvent` rows were created.
- **"Room Trial" rename** — the user-facing noun for a generated
  visualization is now "room trial" throughout `RoomView.tsx` (button:
  "Generate room trial"; mode badges: "Quick room trial — AI
  interpretation" / "Product-accurate room trial — from your uploaded
  photo"; error/empty-state copy updated to match). Deliberately scoped
  to user-facing strings only — `HmVisualization`, `handleGeneratePreview`,
  the `/api/home-material/visualizations` route path, and other internal
  identifiers are unchanged; renaming those would be a large, purely
  cosmetic refactor with no user-facing benefit. OTP screen copy
  ("create/save your room trial") is a separate small follow-up, not
  done in this pass.
- **Fullscreen zoomable room trial viewer** (`components/home-material/
  ImageLightbox.tsx`, new) — clicking a generated room trial image (the
  main result, or either thumbnail in Spatial Compare) opens it
  fullscreen on a dark backdrop; wheel or pinch to zoom (up to 4x), drag
  to pan once zoomed, double-click/double-tap to toggle a 2.5x zoom,
  Escape/close-button/backdrop-click (only while at 1x) to close. Built
  on the same Dialog primitive as `UploadRoomModal` rather than a new
  dependency — plain pointer-event arithmetic, not library-sized.
  Verified via a throwaway isolated test route (deleted after) since no
  session-loaded visualization history exists to click on without a live
  generation, which the depleted Gemini credits blocked at the time.

**Shipped 2026-09-11:**
- Intent text input on `/materials`, styled as "Option C" from
  `research/prototypes/ui-prototype-intent-entry-options.html` (the
  headline's own sentence continuation, not a separate search form) —
  chosen from a 3-option prototype set specifically for balancing
  "intriguing, not overpowering" against keeping the product grid
  visible. Upload/browse/shortlist demoted to secondary text links.
  Tier-0 deterministic matching only (`MaterialsLandingClient.tsx`'s
  `scoreProduct`/`parsePriceMax`/`tokenize`): category+colour+price-
  ceiling keyword extraction scored against the same product array
  already fetched for the grid — zero new API calls, zero AI cost. Falls
  back honestly to the full catalogue when nothing scores above zero,
  rather than claiming a confident match. Tier 1 (embeddings) remains
  deferred per the trigger below.

**Proposed — needs scoping:**
- Extending `lib/home-material/wall-detection.ts`'s existing single
  Gemini call's response schema to also return room-context fields
  (existing wall colour, dominant room colours, visual style,
  windows/doors/obstructions) — **not** a second analysis pipeline.
- Extending the existing deterministic `WEIGHTS` scorer in
  `lib/home-material/recommendation.ts` with intent-match/behavioural/
  visual-similarity terms, keeping the linear weighted-sum shape so the
  shipped `ScoreBreakdown` UI keeps working unchanged.
- A session-scoped (not persistent) preference signal, computed as plain
  arithmetic over fields `MATERIAL_TAXONOMY` already has — no new ML.
- Mobile precision loupe for wall-vertex dragging (drag-activated only,
  native-loupe-convention placement) — a real, validated interaction gap,
  independent of the rest of this roadmap item.
- A Product Intelligence Record **schema** (fields only — fact vs.
  calculated vs. derived vs. inferred vs. semantic, per the review's
  §Product Intelligence) — cheap to formalize now, no embedding
  infrastructure yet.

**Reopens a shipped, working decision — needs its own explicit sign-off,
separate from the rest of this roadmap:**
- Moving the OTP gate from "before room upload" (today's actual shipped
  behaviour, confirmed via `app/api/home-material/rooms/route.ts`) to
  "immediately before generation." Recommended, but changes the
  abuse-surface assumptions the current code was built against — see the
  review doc's dedicated callout before touching `UploadRoomModal`'s
  401-handling or `LoginView`'s `returnTo` logic.

**Deferred — correct idea, wrong time, with a stated trigger to revisit:**
- Precomputed embeddings / vector index infrastructure. Trigger: catalogue
  crosses roughly 150–200 SKUs across multiple retailers. Below that, a
  plain attribute filter outperforms it.
- Persistent, cross-session, account-level taste graph. Trigger: real
  data showing users return across multiple sessions often enough to
  justify the privacy/complexity cost — doesn't exist yet.
- Trial download/reupload recognition (fingerprinting/watermarking/
  registry). Trigger: real users demonstrably losing access to
  account-saved trials and specifically asking to recover via a
  downloaded image. Until then, "log back in, your trials are saved" —
  the much cheaper near-term version — covers the actual need.

**Rejected as proposed:**
- An intent-only landing hero that hides the product grid until the user
  types (cold-start / blank-box problem).
- A visual-trial-first generative hero (highest "AI wallpaper generator"
  positioning risk of any option considered).
- A black-box/ML ranking model replacing the deterministic scorer.
- A hard-coded 15-day trial retention constant (use a configurable
  default instead, revisit with real Cloudinary storage-cost data).
- Time-on-site as a primary success metric.

### Next concrete step

With the intent-first entry shipped, the next items in sequence are the
other "build now" proposals from the review that haven't shipped yet:
server-side visualization caching, the "Room Trial" rename, the mobile
precision loupe, and the room-analysis schema extension — see the
Implementation Sequence section of
`research/home-material-intent-first-review.html`.

### Prototype archive

Every UI layout prototype tour built for this domain (and going forward,
any domain) is kept locally at **`research/prototypes/`** — gitignored,
never pushed to origin, a permanent progress record even after a choice
ships. See `research/README.md` for the index and convention.

## Open questions carried forward

- What real trigger (exact SKU/retailer count) should gate building
  embedding infrastructure — a number to hold the team to later, not a
  vibe.
- Default trial retention window — pick once real Cloudinary storage cost
  for this catalogue's image sizes has actually been checked.
- Whether sponsored placement is even on the near-term roadmap — if not,
  the governance rule above can stay dormant, but is written down now
  while it's uncontested.
