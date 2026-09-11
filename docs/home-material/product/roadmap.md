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
- Server-side visualization cache/dedupe — confirmed via code read that
  `lib/home-material/visualization.ts` has **zero caching today**; every
  Preview click regenerates from scratch even on an identical repeat.
  This is the single biggest concrete cost win available, independent of
  everything else here.
- "Room Trial" as the user-facing name for a generated visualization
  (mostly a rename — `HmVisualization` already carries most of the needed
  data; a `cacheKey`/`savedAt`/`expiresAt`/`version` addition is the only
  schema work).
- OTP screen copy: "Create/save your room trial," never "enter your phone
  number."
- Sponsored-placement governance (never enters the ranking math, always
  labelled) — write this rule down now even before sponsorship is on the
  roadmap.
- "Based on what you've explored" reversible framing + one-click reset,
  wherever behavioural personalization eventually surfaces.

**Proposed — build next, needs scoping** (this is the active next phase):
- An intent text input, added **above** the existing product grid on
  `/materials` — never replacing it. Tier-0 deterministic parsing first
  (category/colour/room/price extraction via keyword rules — no AI call);
  embeddings reserved for vague queries only, once the catalogue justifies
  the infrastructure (see deferred items below).
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

A new round of landing-page layout prototypes — following the same
propose-options → user-picks → implement workflow already established
for this domain (Sage Studio itself was chosen this way) — showing the
intent input integrated into the already-locked Sage Studio hero,
balanced against continued visibility of the product grid/category chips
per the owner's explicit brief: *"intriguing, not shocking; noticeable,
not overpowering."* See the prototype artifact delivered alongside this
roadmap update for the options themselves.

## Open questions carried forward

- What real trigger (exact SKU/retailer count) should gate building
  embedding infrastructure — a number to hold the team to later, not a
  vibe.
- Default trial retention window — pick once real Cloudinary storage cost
  for this catalogue's image sizes has actually been checked.
- Whether sponsored placement is even on the near-term roadmap — if not,
  the governance rule above can stay dormant, but is written down now
  while it's uncontested.
