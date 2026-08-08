# Saree Anatomy Taxonomy — R&D

Running notes from a retailer-led teaching session (started 2026-08-05) walking
through 10 real sample sarees, ordered least → most complex, to build a
precise vocabulary and set of capture/generation rules for saree craftsmanship
— the goal being generations that hold up under zoom, not just at thumbnail
scale. Companion to [`GARMENT_INTELLIGENCE_RND.md`](GARMENT_INTELLIGENCE_RND.md)
(the pipeline stage this taxonomy is ultimately meant to feed) and
[`IMAGE_RND_LOG.md`](IMAGE_RND_LOG.md). **This document is updated after every
sample reviewed in the teaching session — nothing here is final until the
session says so, and nothing decided is to be dropped when the review is over
and implementation starts.**

Retailer's framing for this session: recurring worry that fixes validated on
one benchmark product don't generalize to the next product with a similar
technique — see `gi-test-findings.md` memory for the prior, concrete instance
of this (chikankari kurta fix improved that product, still missed jaali on
the next chikankari product). Working principle adopted for this session:
**a finding only counts as a fix once it's a taxonomy entry, a schema field,
or a deterministic prompt clause — something every future product runs
through — not a change tailored to one sample's photo.**

---

## Starting architecture context (found at session start, 2026-08-05)

- Garment Intelligence (`lib/garment-intelligence/`) and region image
  conditioning (Phase 1 deterministic saree drape + Phase 2
  `ENABLE_REGION_CONDITIONING`) were already built on `rnd/garment-intelligence`
  and merged to `main` on 2026-07-16. Both flags are ON in local `.env`.
  Per `docs/research/GARMENT_INTELLIGENCE_RND.md`, **no paid live generation
  test had ever been run** against region conditioning as of that date, and
  nothing since touches it — this session's live tests (2–3 products, each
  requiring explicit per-product approval — retailer's condition) will be the
  first real validation.
- Current `GarmentIntelligence` schema (`lib/garment-intelligence/types.ts`):
  `construction`, `surfaceTechniques[]` (type/relief/density/handcrafted/
  colors/placement/stitchCharacteristics), `pattern` (motifs/layout/scale),
  `texture`, `craftsmanship`, `regions[]` (model-proposed ROI observations),
  `back`. **None of the saree-specific vocabulary below exists in this schema
  yet** — border/pallu/buti are not distinguished, there's no boota-vs-buti
  concept, no corner-merge relationship, no color-transition field, no
  compound-border structure, no per-motif multi-technique composition, no
  capture-difficulty flags. This session's output is net-new schema surface,
  not a refinement of already-modeled fields.
- Region conditioning today (`lib/product/part-slots.ts`
  `SAREE_GEN_REFERENCES`): only 2 reference slots for saree — pallu
  (role `layout`) and border (role `texture`), capped at 2/view. No buti/body
  reference slot. No compound-border sub-band handling.

---

## Core geometry (orientation-invariant — this is the load-bearing rule)

**Border = the two long edges of the cloth (runs the full length). Pallu =
the short edge at one end.** This is defined by the geometry of the fabric,
never by how a given photo happens to be framed — resolves the "which way is
up" problem completely, for any orientation a retailer might shoot in.

**Top border vs. bottom border (verified self-consistent, retailer-confirmed
2026-08-06):** standing at the pallu edge, facing into the body of the saree,
fabric right-side-up in front of you — the border on your right hand is the
**top** border, the border on your left is the **bottom** border. Equivalent
check: standing ON a border facing into the body, it's the **bottom** border
if the pallu is on your right, **top** if pallu is on your left. The bottom
border is the one nearest the wearer's feet and is where the front pleats are
anchored — pleat close-ups should be read against the bottom border
specifically.

**Motif-directionality heuristic (soft signal, not a hard rule — confirmed
across Samples 1, 2, 3, 4; two explicit boundary cases found in Samples 5–6):**
a directional motif's **base/anchor end** (broad end of a teardrop, the stem
of a floral spray — whatever the motif "grows from") points toward the
**bottom** border; its **terminal/outward end** (the point, the flower head —
whatever it "grows into") points toward the **top** border. Useful as a
cross-check against the geometric rule, never a substitute for it.
- **Boundary case 1 (Sample 5):** radially symmetric motifs (round rosettes,
  no stem/point asymmetry) carry no directional signal — geometric rule only.
- **Boundary case 2 (Sample 6):** continuous/connected vine-type buti (no
  discrete repeat unit) also carries no usable directional signal — geometric
  rule only.

---

## Boota vs. buti (distinct vocabulary, distinct roles)

- **Boota** — the elaborate design running on the border and/or pallu edges.
  Often repeats.
- **Buti** — the (simple-to-complex, sometimes directional) motif filling the
  **body**, between border and pallu. Has direction: a vine-style buti running
  top-to-bottom or side-to-side can terminate differently approaching the
  edges — orientation of the repeat matters, not just the motif's shape.
- **Buti pattern-type — discrete vs. continuous (Sample 6, important split
  for how images are used):**
  - **Discrete/repeating-unit** buti (teardrop, floral spray, paisley — every
    sample 1–5): a single macro crop of one instance is representative of the
    whole — it carries BOTH the motif's design/shape AND its surface texture
    simultaneously. Safe to say "reproduce this shape, repeated as shown in
    the main image, with this surface quality."
  - **Continuous/connected (jaal/trailing vine)** buti (Sample 6): there is no
    single repeatable unit — the design IS the full spread across the body.
    A macro crop here is only ever a texture sample of an arbitrary fragment,
    **never** a layout reference. Must be captioned as texture-only evidence;
    layout/composition authority stays entirely with the main image. Getting
    this classification wrong risks the generator either stamping a
    texture-crop as if it were a repeatable motif, or ignoring true layout.
  - **Confirmed as an intentional capture convention (Sample 8):** retailer
    explicitly narrated an overview image (full design/placement, e.g. how a
    border-adjacent buti band is composed) followed by a macro of the same
    motif (texture/depth only, design already established by the overview)
    as deliberate, paired shots — not something to infer per-sample, this is
    how the retailer captures border-adjacent/discrete bands in general.

### Boota/buti/pallu relationship types found so far

1. **Same design, pallu = border rotated 90°** (Samples 1, 3, 5). Corner
   merge is deliberately mitered/pattern-matched — motifs turn the corner
   coherently, not an abrupt cut (confirmed visually, Sample 5 image 5).
2. **Same motif family, different density between border and body** (Sample
   1 nuance): border = connected/denser chain of the motif, body buti = same
   motif shape but isolated/simpler. Not quite "same" and not quite
   "different" — a third sub-case worth keeping distinct.
3. **Boxed pallu** (Sample 6, this was predicted in the original terms-setting
   message and has now been shown concretely): border pattern **continues as
   a frame** around the pallu edge, and the pallu carries **additional,
   distinct content inside that frame**. Corner treatment here is simpler
   than case 1 — the frame just keeps running consistently around the turn;
   the interior pallu-specific content doesn't need edge-continuity logic of
   its own since it's not itself running along an edge.
4. **Fully independent pallu and border designs** — flagged by retailer as
   still to come, not yet shown.
5. **Nested/double-framed boxed pallu** (Sample 7, elaboration of case 3): the
   border motif frames the outer edge AND reappears as a second, inner frame
   around the unique pallu content — sandwiching it, rather than a single
   frame.

### Buti orientation axis — two conventions, do not conflate

Confirmed via Sample 7 (banarasi tissue, first orientation-flipped sample):
a single saree can carry **two distinct buti populations with two different
running axes**:
- **Perpendicular to the pallu** (spans border-to-border across the width) —
  the convention established in Samples 1–3 for general body buti.
- **Parallel to the pallu** (runs along the length, hugging one specific
  border) — seen in Sample 7 as a second, larger, differently-designed buti
  band confined to running alongside the bottom border only, nowhere else on
  the body. Distinct from the general (smaller, perpendicular-axis) body buti
  on the same saree.

Where a border-adjacent band exists, three hard constraints follow directly
from the top/bottom distinction actually mattering, not being decorative:
1. **Placement is asymmetric** — the band belongs to one specific border
   (here, bottom) and must never appear near the other. The two long edges
   are not interchangeable in a design like this.
2. **No mirroring** — the individual leaf/motif shapes in the band must not
   be flipped, even though a "close enough" mirror is an easy generator
   mistake.
3. **No axis rotation** — parallel-to-pallu bands must not be rendered
   running perpendicular (across the width) instead, and vice versa for
   perpendicular-axis buti.

### Selective embellishment across color variants

Sample 7: two color variants of what is otherwise the same buti motif (one
green, one red/pink) — only the green one carries crystal-stone embellishment,
the red/pink one doesn't. Embellishment presence/density cannot be assumed
uniform across color repeats of "the same" design; needs per-instance
tracking, not a single fact attached to the motif as a whole.

---

## Color

Three independent layers, not one "color" fact:
1. **Base fabric color(s)** — solid, gradient, or hard-line/abrupt split.
   Record which.
2. **Design/boota/buti color(s)**.
3. **Embellishment color(s)** (thread, mirror, zari, stones, tassels) —
   independent of the above two.

### Hard-line color split (Sample 8, first full example)

The split runs **perpendicular to the length axis** at one point between the
pallu and the far end — the *whole width* (both borders plus the body)
changes color together at the same point along the length, not a diagonal or
partial split. The pallu-side color typically extends only partway; the rest
of the length (toward the plain far end, where the front pleats form) carries
the second color.

**A hard-split saree can carry two semi-independent decorative systems, one
per color zone** — not just a color change. Sample 8: the pink zone has its
own buti (a lotus motif); the cream zone has a completely different small
buti (white flower + gold leaf) AND its own border-adjacent buti band
(paisley + floral) that doesn't exist in the pink zone at all. Border and
pallu boota design stayed the same across the split, only body-level buti and
buti-band content differ by zone. Must not cross-contaminate — a zone's
motif system belongs only to that zone.

**Why border-adjacent buti bands recur (Samples 7 and 8) — functional
rationale, not arbitrary:** per retailer explanation, this concentrated
decorative work is deliberately placed to show prominently at the front
pleats when draped, which is why it hugs the bottom border specifically. This
is a real fashion-design reason, not a coincidence — worth treating as a
prior (a border-adjacent band is more likely near the bottom border than the
top) rather than something to infer freshly per product with no expectation.

### Hard-split + gradient can nest (Sample 9)

A saree can combine both color mechanisms: a hard line splits it into two
zones, and *within* one of those zones there's a further gradient (here:
black solid on one side, mustard→orange gradient on the other). Not mutually
exclusive mechanisms.

**Borders can differ completely between color zones — not just buti/body
content (extends the Sample 8 "semi-independent decorative system per zone"
finding to the border itself).** Sample 9's two zones have fully different
border compositions (different motifs, different embroidery layout) on
different width bands, though sharing the same underlying craft
techniques/vocabulary (zari embroidery, floral idiom) — different design,
same technique family, a useful middle case between "identical" and
"unrelated."

**Border width itself can be asymmetric between top and bottom border,
within a single zone — same pleat-emphasis rationale as the buti-band
finding, now applied to border width.** The bottom (pleat-facing) border was
both wider and design-different from the narrower top border in Sample 9's
black zone. Reinforces: top and bottom borders are never assumed symmetric —
not just in content, but in physical proportions.

**Capture-efficiency heuristic (retailer-stated, conditional):** when border
and pallu share the same design AND there is only one buti population to
document, the hard-split junction itself can serve as an economical "main"
reference image — it shows both zone colors, both border designs, and the
split line in one shot, reducing total images needed. Does **not** apply to
multi-buti / Sample-7-or-8-shaped products, where the added complexity needs
its own dedicated shots.

### Absence is information too (Sample 9 — important, generalizes beyond color)

The gradient zone in Sample 9 has **no buti of its own** — what faintly shows
through it in a photo is the *other* zone's buti bleeding through the sheer
fabric, not real embellishment on that zone. Retailer's framing: capturing
"what's not there" matters as much as capturing what is, because a system
that only ever records positive facts will default to inventing plausible
detail where none exists (every other sample so far has had buti nearly
everywhere — a generator has every reason to assume this one does too, unless
explicitly told otherwise). **The schema needs to support asserting explicit
negative facts** ("this zone has no buti," not just silence on the buti
field), the same way `BACK_FALLBACK_CLAUSE` already asserts "the back is
plain, don't duplicate the front" for tops/kurtas elsewhere in this codebase
— this generalizes that existing pattern from "back of garment" to "any zone
that is plain by design."

**Related capture pitfall:** sheer/see-through fabric can make one zone's or
layer's motifs visually appear to show through onto an adjacent zone in a
photo. Must be attributed to its true source zone, never double-counted as
"present" in the zone it happens to show through onto.

### Compounding/layered relief — relief is not binary (Sample 10)

Beyond raised-vs-flat (the construction-method finding above), Sample 10
surfaces a heavier case: **physically stacked layers of work**, where one
technique sits literally on top of another (zari base layer, then thread
stitching over it, then mirror-work discs set on top of that, then stone/bead
accents on top of that), producing cumulative real thickness, not just single
raised relief. Retailer confirmed this is a real, observed failure of the
current pipeline — a live generation attempt on this exact product flattened
all of it to something reading as 2D/printed. This is the sharpest concrete
evidence in the whole session of the craftsmanship-fidelity problem that
motivated this taxonomy in the first place; worth keeping as the canonical
"hard case" when evaluating whether a future fix actually works.

**Two buti systems can coexist in the same physical space, not just occupy
separate zones.** Sample 10 has both a continuous, bottom-concentrated vine
buti (border-adjacent, per the established pattern) AND a fully separate
discrete crochet-flower appliqué buti scattered uniformly across the whole
body, including directly over the vine's area — two independent systems
layered together, not mutually exclusive placement.

**A single motif can look different depending on viewing angle/position**
(Sample 10, pallu overview vs. bottom-border overview of nominally the same
buti) — another reason a single macro reference can't be treated as fully
representative; position/angle context matters, not just "here is the
motif."

### Relationships over rigid labels (Sample 10 — important for synthesis)

Sample 10's border has a band that extends inward onto the body, merging
with the bottom buti-band — retailer directly asked whether this should be
classified as part of "border" or presented as its own thing, then answered
their own question with the more important point: **the future system
should map all uploaded images together into a coherent whole regardless of
what label any single image was filed under**, not force every element into
one exclusive named bucket. Recommendation for synthesis: model elements
like this as **relationships/adjacencies** (this element bridges border and
buti-band) rather than a forced single category — a rigid label taxonomy
breaks exactly on boundary cases like this one, and boundary cases are
common, not rare (compound borders, boxed pallus, and border-adjacent bands
have all been boundary-ish cases already).

---

## Border structure — compound is the common case, not the exception

Seen in Samples 3, 5, 6 (3 of 6 so far): a border is frequently **multiple
distinct sub-bands stacked together** — e.g. a wide motif panel + a narrower
stone/trim strip + a scalloped or dot-stud edge finish — each with its own
technique. A schema treating "border" as one flat description will undersell
most real sarees. Model as an ordered stack of sub-bands, not a single field.

**Edge additions (fringe/tassel/beads) are their own zone**, distinct from
border-boota (Sample 2, first concrete example): a hanging beaded fringe is a
dangling 3D element with its own shadow and micro-movement — a fundamentally
different rendering target from flat embroidery, arguably one of the harder
things to get a generator to render believably since it has no 2D analogue to
lean on. **Placement varies per product** — Sample 2's fringe ran along the
border edge itself; Sample 7's tassels live only at the pallu end, on neither
border. Must be recorded per-product, never assumed universal.

**A single motif can itself combine multiple techniques** (Sample 3's floral
rosette: metallic thread petals + a ring of faceted stones + a contrast-color
velvet/satin center — three material classes in one motif). Current schema's
`SurfaceTechnique` is flat (one type/relief/density per entry) and would
collapse this into one entry, losing the composition. Needs nested structure.

---

## Capture-difficulty axes (orthogonal to structural/design complexity —
## do NOT conflate "simple design" with "easy to capture correctly")

1. **Self-tone / low contrast (Sample 4).** When embellishment color ≈ base
   fabric color, the main wide-shot image is not just under-detailed, it is
   **blind to the work's existence** — no amount of prompt engineering
   recovers information the main photo never captured. Architectural
   implication: Garment Intelligence's own pass-1 ROI-proposal step looks at
   a capped, low-res whole image to decide what's worth a close-up crop in
   pass 2 — on a self-tone saree, pass 1 likely can't see the work exists, so
   automatic ROI detection fails closed. The one thing that saves this case
   is that retailer-uploaded part/close-up images are already prioritized as
   evidence over model-guessed ROIs (a design decision made for other reasons
   in GI round 2) — reinforces that retailer capture guidance must say "shoot
   close-ups even when it looks plain," since a self-tone product is exactly
   the one where a retailer is likely to skip them.
2. **Relief-ambiguity (Sample 5, confirmed as technique-class-specific via a
   within-product control in Sample 6).** Real, physically raised work can
   still photograph as flat/printed — not a lighting fluke, but tied to
   technique class: **tightly-woven, geometric metallic patterns (herringbone,
   chevron, brocade-style jacquard) consistently misread as flat**, while
   **loose organic thread embroidery (satin/chain-stitch vines, florals)
   reads as dimensional far more reliably**, confirmed side-by-side on the
   same saree under the same light (Sample 6 images 5 vs. 6). Consequence:
   for the geometric-metallic class, "trust the photo to show relief" is the
   wrong strategy — needs a deterministic text assertion ("this technique is
   inherently raised, dimensional embroidery") sourced from technique-name
   domain knowledge, independent of what that day's photo happened to show.
   Pixels and text are not interchangeable here: pixels solve "what does the
   pattern look like," text solves "trust this is dimensional even when the
   photo is lit ambiguously."
   - **Refinement (Sample 7) — the real distinguishing factor is likely
     construction method, not visual style.** Sample 7's explicit guidance:
     its pallu's zari brocade/jacquard weave is CORRECTLY allowed to render
     flat/printed-looking — that's authentic to the technique, not a fidelity
     failure. Sharper rule than "geometric vs. organic": techniques **woven
     into the fabric structure itself** (jacquard, brocade) are genuinely
     lower-relief and rendering them flat is correct; techniques **applied
     onto the fabric surface** (embroidery, appliqué, stitched thread,
     stonework) are genuinely raised and need the dimensional assertion
     regardless of what the photo shows. "Geometric-looking metallic patterns
     misread as flat" (Samples 5–6) was likely a visual proxy for this
     construction-method distinction, not a separate rule — reconcile under
     construction method, not visual geometry, once more samples confirm it.
   - **Confirming data point (Sample 8):** the bottom-border buti band (zari
     paisley + floral embroidery, applied/stitched-on) was explicitly called
     out by the retailer as NOT 2D/printed — consistent with applied/stitched
     techniques needing the raised-dimensional assertion, same rule as
     Sample 7's opposite case (woven-in jacquard, flat is correct).
   - **New technique vocabulary (Sample 8):** "padded thread work" — satin/
     long-and-short stitch worked over a raised padding/base (trapunto-like),
     distinct from flat satin stitch; another applied/stitched technique that
     is genuinely raised by construction.

---

## Architecture reality (why detail still gets dropped even when provided —
## established mid-session, before Sample 4)

Gemini does not composite/paste reference pixels into a region — it
re-synthesizes the whole image, influenced by everything given to it. A
close-up reference is advisory, never a hard constraint, however well
labeled. Concrete failure mechanisms already documented in this project:
- **Recency/position bias** — late-prompt instructions win over early ones
  (already fought once: camera-orientation clause had to move to the end of
  every prompt to stop losing to competing instructions).
- **Prompt-budget trimming** — renderer caps notes ~900 chars; low-priority
  facts get silently cut before the model ever sees them.
- **Over-anchoring** — more descriptive text has previously made results
  WORSE on other products, not better (verbose prose invites reinterpretation
  rather than pinning pixels).
- **Scale/extent drift** — a real documented bug: a pallu reference got the
  pattern right but rendered it longer than the real one. The model can pick
  up "what" and still lose "how much."

**Working design target (not yet implemented):** each reference image needs
one precise, positionally-late instruction stating its authority and its
limit — e.g. "Image 2 shows the border's real repeat and how much of the
border height the motif occupies — do not enlarge past this proportion.
Image 3 is a macro of one motif from Image 2 — texture only, do not invent
additional embellishment." Not "more description," but scale/extent
guardrails plus an explicit non-hallucination clause per image. The
"nested tree" shape (main image = orientation/layout/scale ground truth,
overview = zone rhythm + proportion, macro = surface texture) is not fixed —
it branches on buti pattern-type (discrete vs. continuous, see above). Even
done well, the most demanding single motifs (multi-material, heavy metallic
relief) are likely past what prompting/conditioning alone can guarantee —
that ceiling is why pixel-compositing/reinjection exists as a separate,
already-identified reserve track (`vision-pipeline-v2-direction` memory,
Phase 3 refine work) rather than something to expect from this effort alone.

---

## Sample log

| # | Saree | Fabric | Border/pallu relationship | New concept(s) introduced |
|---|---|---|---|---|
| 1 | Golden shimmer tissue, teardrop boota | Tissue/fendi silk | Pallu not distinctly captured (open Q) | Base geometry rule; motif-direction heuristic established; border-buti shared motif, different density |
| 2 | Tissue organza, gold zari + beaded fringe | Tissue organza | Pallu = border rotated (inferred) | Edge fringe/tassel as own zone; tone-on-tone buti (low color contrast, not yet full self-tone) |
| 3 | Golden-brown silk blend, aari floral/paisley | Silk blend | Same design, rotated | Compound (2-part) border; multi-material single motif |
| 4 | Red chiffon/georgette, self-tone weave | Chiffon/georgette | Same design, rotated | **Self-tone/low-contrast capture-difficulty axis**; GI pass-1 ROI-detection risk identified |
| 5 | Coral georgette, gold zari paisley | Georgette | Same design, rotated | **Relief-ambiguity capture-difficulty axis**; corner-merge visual confirmation (mitered) |
| 6 | Sage green georgette, floral vine (Mul Chanderi) | Mul Chanderi | **Boxed pallu** (new relationship type) | Relief-ambiguity confirmed as technique-class-specific (within-product control); compound (3-part) border; **buti pattern-type split (discrete vs. continuous)** |
| 7 | Seafoam banarasi tissue silk, resham+zari leaf motifs | Banarasi tissue silk | Boxed pallu (nested/double-frame variant) | **First orientation-flipped sample** (pallu at bottom of frame) — geometric rule re-derived fresh, confirmed shown border = TOP (reverse of Samples 1–6); border-adjacent buti band (2nd population, parallel-to-pallu axis) vs. general body buti (perpendicular axis); tassels at pallu-end only, not border; selective embellishment across color variants; relief-ambiguity refined to construction-method (woven-in vs. applied-on) |
| 8 | Cream/pink hard-split silk, floral+zari | Silk | Same design, rotated (border/pallu unaffected by split) | **First hard-line color split** (perpendicular to length, whole width switches together); color zone determines buti system (2 near-independent decorative systems in one product); 2nd confirmed border-adjacent buti band instance, functional rationale established (pleat-area emphasis); overview/macro-texture split confirmed as deliberate retailer convention; "padded thread work" technique added |
| 9 | Black/mustard-orange hard-split with gradient, zardozi paisley | Silk/georgette (sheer) | Same design (gradient-zone border = pallu design) | Hard-split + gradient nesting; borders differ completely between zones (different design, shared technique family); asymmetric border WIDTH top vs bottom (pleat rationale extended); capture-efficiency heuristic (conditional shortcut); **absence-as-information** (gradient zone has no buti; see-through bleed-through pitfall) |
| 10 | Peach georgette, heavy layered zari/mirror border | Georgette | Same design, rotated (border has inward-extending band merging into bottom buti) | **Compounding/layered relief** (stacked techniques, not just single raised relief) — confirmed real production failure on this exact product; two buti systems coexisting in the same space (continuous bottom band + uniform discrete crochet appliqué); viewing-angle-dependent motif appearance; border-extension boundary case → relationships-over-labels recommendation |

---

## Implementation constraint — no human narrator in production (flagged at Sample 7, 2026-08-06)

Retailer's explicit concern, **to be addressed at synthesis (task: "Synthesize
taxonomy into concrete GI schema + prompt design"), not before**: this entire
teaching session works because a human is present to say "this is the
border," "this buti runs parallel to the pallu," "this color variant has
stones and that one doesn't." **Production has no narrator** — the platform
has to arrive at all of this from images (plus whatever minimal structured
input exists at upload) with no one pointing anything out, for every future
product, unassisted.

Sample 7 is the sharpest example yet of why this is hard, not just a general
worry. The working mental model through Samples 1–6 was roughly one main
image + one border reference + one pallu reference (if distinct) + one buti
reference — a small, fixed set of "slots." Sample 7 broke that: **three
distinct buti/motif populations on one product** (general body buti on a
perpendicular axis, a border-adjacent buti band on a parallel axis confined
to one specific edge only, plus the pallu's own internal leaf motifs) that
each have to be identified, counted, and correctly mapped to position and
orientation in the main image — with nobody stating up front that there are
three, or where each one is.

This exposes a real architecture mismatch worth carrying into synthesis: the
part of the pipeline built to handle a *variable, unknown* number of
interesting regions is Garment Intelligence's model-proposed ROI step
(pass 1 looks at the whole image and proposes up to 4 regions) — but that
mechanism only feeds the *text* side (pass-2 surface-technique description).
The part that gets real pixels to the generator (region image conditioning,
`ENABLE_REGION_CONDITIONING`) is the opposite shape: a small, *fixed* set of
named slots (pallu, border) tied to retailer uploads, per
`lib/product/part-slots.ts`. For a Sample-7-shaped product, neither half
alone is sufficient — the flexible-count mechanism doesn't carry pixels to
the generator, and the pixel-carrying mechanism doesn't flex its count.
Closing that gap (auto-detected regions wired to real image conditioning,
and/or a retailer upload UX that can name more than two zones) is now an
explicit item for the synthesis proposal.

## This is a seed, not a final answer — continuous learning + admin feedback loop required (retailer framing, 2026-08-06, end of Sample 10)

Explicit framing for what this whole session is for, restated by the
retailer at the close of the 10-sample review: **this is a one-time,
small, curated bootstrap** — not an exhaustive rulebook the system applies
statically forever. Requirements for synthesis:

1. **The system keeps learning from every future upload**, not just this
   session's 10 products — this taxonomy is a starting vocabulary/prior, not
   a ceiling.
2. **When a future product shows something the system cannot comprehend**
   (a technique, relationship, or placement pattern outside current
   vocabulary), it needs to be able to **recognize its own uncertainty** and
   surface it — proposed mechanism: an admin feedback/questionnaire page
   where the retailer answers a flagged question, and that answer gets
   folded into the system's persistent vocabulary/norms going forward. Not
   designed yet; an explicit requirement for the synthesis proposal.
3. **The end goal, stated plainly:** capture enough of "what makes the
   product what it is," in the right order and specification, that the
   generator can build a near-faithful result close to from scratch — the
   working belief being that faithful generation follows close to
   mechanically once sufficiently complete, correctly-structured information
   is provided, which is the whole reason this session went to this level of
   depth on vocabulary before touching any code.

This compounds the "no human narrator" constraint above: it's not enough for
the system to work unassisted on a fixed vocabulary — it has to be able to
grow that vocabulary over time, with a defined (if lightweight) human-in-the-
loop path for the cases it doesn't yet know how to handle.

## Phase 3 — implemented (2026-08-07)

`lib/garment-intelligence/region-references.ts` (new): threads GI's own
evidence (retailer part uploads + model-proposed ROI crops, re-derived from
the stored main image via the bboxes persisted in Phase 1) into
generation-time image conditioning, extending the existing 2-slot
pallu/border mechanism rather than replacing it. Flag `ENABLE_GI_REGION_REFERENCES`
(default OFF), nested under `ENABLE_REGION_CONDITIONING`. Front view only —
GI's region pass never runs on the back.

Each reference is paired with an explicit placement sentence sourced from
GI's structured data (`ButiPopulation.placementZone`/`axis`,
`SareeBorder.edge`/`design`), not a generic template — per the live-test
finding that a macro crop shown alone carries no information about where it
belongs or which way is up, and text must carry that fact instead of being
inferred from the crop's own incidental framing. Approximate label-matching
(region → population/border), documented as best-effort in code. Total extra
references capped at 5 across identity/cross-view/named-slot/GI-sourced,
trimming only the GI-sourced tail.

**Live-tested (2026-08-08, Sample 10, catalogue objective, confirmed via imageInputs 5-6 vs. baseline 2 — region conditioning genuinely fired):** mirror-work preservation held up again (consistent across every test round so far). The specific confinement problem (second buti population spilling outside its stated zone) did NOT resolve — retailer's read: nano-banana-2 improved noticeably this round; nano-banana-pro still misplaces the buti. Working theory: real macro crops may read to the model as general "this saree has dense floral texture" evidence rather than a spatially confined population, so pixel conditioning alone doesn't guarantee the structural placement fact survives either — reinforces the mask-edit feature as the real backstop for this specific failure class, not a sign Phase 3 was pointless (mirror-work + overall texture richness still benefited).

## Live-test agreement (retailer condition, 2026-08-05)

2–3 of the 10 products will get an actual live paid test-generation once the
taxonomy work is drafted, to validate against real output — **scope and
product selection is entirely the retailer's call, per-product approval
required before any paid call runs.** Not a blanket go-ahead.
