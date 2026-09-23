/**
 * Deterministic overlay rendering — the concrete implementation of
 * research/catalogue-to-campaign.html's hardest rule: generative AI never
 * renders the pixels of a fact. Every element here (title, price, discount
 * badge, CTA, logo, scrim, feature rows, trust badges) is built from typed
 * props via Satori's flexbox layout, rasterized by resvg, and composited
 * onto the (separately resolved) hero image with sharp — the same
 * `.composite([{ input, blend: "over" }])` pattern already proven in
 * lib/model-gen/erase.ts. No image-generation model is ever involved here.
 *
 * All three families are full-bleed (see templates.ts's CreativeTemplate.
 * layout) — the photo fills the whole canvas, never a separate solid-fill
 * panel. hero-editorial/styled-promo use a simple bottom-up scrim over one
 * "cover"-fit crop (buildFullBleedElement, V1's original tree, untouched).
 *
 * promo-benefits (V1.3, this revision) needs a different compositing
 * strategy because it carries far more text than the other two families.
 * Every earlier attempt (a plain gradient, a blurred copy with a feathered
 * transition, a flat color-matched panel) placed the text-zone boundary at
 * a FIXED FRACTION of canvas width, chosen without looking at the actual
 * photo. That's the root cause every one of those attempts shared: hero
 * photos were essentially center-composed portraits — nothing about the
 * generation asked for off-center framing — so a fixed-fraction boundary
 * drawn from the left edge would, more often than not, land on top of the
 * model instead of on empty background. No amount of retuning the fraction
 * fixed that; the boundary has to come from the photo, not an assumption
 * about it — which is what the content-aware scan below does.
 *
 * generateModelImages() now also accepts an optional compositionHint (see
 * lib/model-gen/prompt-sets.ts) that biases generation itself toward
 * leaving real open space on one side, and lib/marketing-creative/workers/
 * render.ts's generate-new path sets it. That's a bias on a generative
 * model, not a guarantee — the scan below stays as the safety net
 * regardless of whether the hero photo came from that path, an existing
 * catalogue image, or anywhere else this template might be pointed at.
 *
 * V1.3's current design (this revision) computes the boundary from the
 * photo's actual content: computeColumnComplexity slices the canvas into
 * vertical strips and measures each one's grayscale contrast (a cheap,
 * local, no-network proxy for "is there a subject/detail here") via sharp's
 * own stats; resolveSafeTextZoneWidth then walks in from the left edge and
 * stops the moment contrast spikes — i.e. the moment it's likely hit an arm,
 * a sleeve, a prop — instead of assuming a percentage is safe. The panel
 * width used for both the composited photo crop AND the text layout is
 * whatever that scan actually finds, clamped between a minimum usable width
 * and an ideal ceiling. This is the direct fix for "part of the model is
 * still covered" — it no longer guesses.
 *
 * The panel itself is a blurred copy of the SAME verified-safe region (not
 * a flat color) — once the boundary is genuinely content-aware, blurring is
 * safe again, and it reads as a real continuation of the photo's own tones
 * and texture rather than an arbitrary flat swatch sitting next to a richly
 * detailed scene, which was the other half of the retailer's feedback (a
 * color-matched flat panel still felt visually disconnected from an ornate,
 * detailed courtyard photo — matching hue isn't the same as matching visual
 * richness). A short feather where the crisp product crop meets the blurred
 * panel softens the seam.
 *
 * Content is a flat column of peer elements (kicker, title, features,
 * price+CTA, trust badges) under one fixed, density- AND height-scaled gap
 * (flex-start flow, not justifyContent:"space-between" — see
 * resolveSafeTextZoneWidth's neighbourhood for why), each separated by a
 * hairline divider. Text is white again (not dark ink), since the panel is
 * once more a photo-derived background of variable tone, not a flat light
 * fill.
 *
 * Two more joint-layout fixes (2026-09-23), both from the same root cause —
 * font/spacing/crop decisions computed from canvas.width alone, blind to
 * canvas.height: heightScaleFor grows type and gaps on taller canvases
 * (vertical/pinterest have real extra room a square canvas doesn't; without
 * this every canvas got identical type sizes and the surplus just sat empty
 * below the last line). And the product crop no longer forces itself to
 * cover the full canvas HEIGHT unconditionally — on a tall canvas that
 * forced more zoom than the photo's own proportions called for, cropping
 * the sides of the garment just to reach that height; it now falls back to
 * an undistorted width-fit crop, bottom-anchored, with the panel's
 * background filling in the headroom above when the photo doesn't reach the
 * top on its own.
 *
 * It also drops the promo-benefits CTA's filled-pill styling (a fake button
 * an Instagram/Pinterest viewer might mistake for something tappable, when
 * the actual click path is the platform's own link affordance) and the
 * price banner's solid accent fill (de-emphasized to an inline text line,
 * present without dominating).
 *
 * Icon rendering: small plain-function icon components (lib/marketing-
 * creative/icons.tsx), not lucide-react's exported components directly —
 * those are wrapped in React.forwardRef, which satori's tree walker (a
 * from-scratch element interpreter, not a real React render pass) cannot
 * invoke; live-tested and confirmed it throws "Cannot read properties of
 * null (reading 'useContext')". icons.tsx renders the identical <svg> shape
 * using the same path data, just without the forwardRef wrapper. See that
 * file's header for the full explanation.
 *
 * V1.4 (2026-09-23) fixes the retailer's next round of feedback — a real
 * marketing-design brief diagnosing that the panel still behaved like a
 * FIXED-SIZE content box despite being nominally content-aware. Root cause:
 * two ceilings, both computed from canvas geometry alone rather than from
 * how much calm space the photo actually has. (1) resolveSafeTextZoneWidth's
 * search used to stop at IDEAL_TEXT_ZONE_FRACTION (42%) no matter how much
 * further the photo stayed calm — so any render whose real safe space
 * exceeded 42% (increasingly common now that compositionHint:"right-third"
 * biases generation toward leaving open space) never got to use the rest of
 * it. Fixed by separating the search ceiling (new MAX_TEXT_ZONE_FRACTION,
 * 60%, a product-protection bound) from the typography pivot (the same 42%,
 * now just a pivot, not a search limit). (2) typeScaleForZone (renamed from
 * densityScaleFor) used to cap at 1.0 — type could shrink for a cramped
 * zone but never grow for a spacious one, so even a discovered wide zone
 * rendered at the same base font size as a narrow one. Fixed by uncapping
 * the top end (1.3, mirroring heightScaleFor's own cap). Together these are
 * the actual "fit-to-region" lever: a genuinely wide calm zone now both
 * gets to exist and renders visibly larger type in it, instead of the same
 * fixed column at the same fixed size regardless of the photo.
 *
 * This uncapping surfaced a real, separate, PRE-EXISTING correctness bug
 * that simply hadn't been exercised by earlier testing: the price row
 * (price + discount badge) and CTA row (text + arrow icon) each lay out two
 * auto-width `whiteSpace:"nowrap"` children in a flex row with no explicit
 * width. satori/Yoga defaults flex children to shrinkable, and once such a
 * row's available width came out narrower than its children's combined
 * natural width (which typeScale growing above 1x made much more likely to
 * actually happen), Yoga shrank the LAYOUT boxes used for gap/positioning
 * while the glyph paths satori draws stay shaped at full natural size
 * regardless — so the second child rendered on top of the first instead of
 * beside it. Fixed with `flexShrink: 0` on each of those four text/label
 * divs, the standard fix for "this inline content must never shrink below
 * its natural size."
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { reencodeGeneratedImage } from "@/lib/images/reencode";
import { loadCreativeFonts } from "./fonts";
import { ICONS } from "./icons";
import { isRegionPresent, type CreativeTemplate } from "./templates";
import type { Canvas, DeterministicCopy } from "./types";

const INK = "#141110";
const PAPER = "#ffffff";
const ACCENT = "#b8622a";

function scale(canvasWidth: number, base1080px: number): number {
  return Math.round(base1080px * (canvasWidth / 1080));
}

/** A white RGBA raw buffer whose alpha ramps 0→255 across the first
 * `featherWidth` px (left edge fully transparent, growing opaque) and then
 * holds at 255 for the rest — used as a `dest-in` mask so a sharp crop's
 * left edge fades in gradually, rather than cutting in abruptly at a hard
 * edge. */
function buildHorizontalFeatherMask(width: number, height: number, featherWidth: number): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let x = 0; x < width; x++) {
    const alpha = x < featherWidth ? Math.round((x / Math.max(1, featherWidth - 1)) * 255) : 255;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = alpha;
    }
  }
  return buf;
}

/** Same idea as buildHorizontalFeatherMask, rotated 90° — one edge fades in
 * from transparent instead of the left edge. Used when the crop can't
 * safely reach the full canvas height and leaves a gap the panel's
 * background needs to fill (see renderCreativeCanvas): without this, the
 * fill met the crisp photo at a hard, uncomposited seam, which is exactly
 * what read as an obviously pasted-on "patch" rather than a real
 * continuation of the scene — live-tested (2026-09-23), retailer feedback:
 * "the vertical image is still prepared by adding the extension patch/
 * swatch at the top." V1.5 always top-anchors the crop (any gap now falls
 * at the BOTTOM — "shift things down... there is still so much empty dead
 * gap at the bottom" per the same feedback), so `edge` picks which side
 * fades: "top" (fades in descending from y=0, gap above) or "bottom"
 * (fades out approaching height, gap below). */
function buildVerticalFeatherMask(width: number, height: number, featherHeight: number, edge: "top" | "bottom"): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const distanceFromEdge = edge === "top" ? y : height - 1 - y;
    const alpha = distanceFromEdge < featherHeight ? Math.round((distanceFromEdge / Math.max(1, featherHeight - 1)) * 255) : 255;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = alpha;
    }
  }
  return buf;
}

const STRIP_COUNT = 24;
/** The TYPOGRAPHY PIVOT, not a search limit (V1.4 revision — see below).
 * Zones narrower than this shrink type; zones wider than this grow it. Kept
 * at V1.3's original value so a zone landing exactly here renders identical
 * to before this revision. */
const IDEAL_TEXT_ZONE_FRACTION = 0.42;
/** Live-tested (2026-09-23) and confirmed the real root cause of "content
 * forced towards the left no matter how much empty space is there": the
 * safe-zone WALK used to stop searching at IDEAL_TEXT_ZONE_FRACTION, so even
 * a photo with far more genuine calm space than 42% never got to use it —
 * a de facto fixed-size box regardless of the photo. This is a separate
 * ceiling from the pivot above: it only bounds how far the content-aware
 * scan is allowed to walk, protecting the product's minimum share of the
 * frame — it is not a target width, and most renders land well under it. */
const MAX_TEXT_ZONE_FRACTION = 0.6;
/** A small baseline-establishing count, NOT a content-overriding floor —
 * live-tested (2026-09-22) and confirmed a large "minimum" here was forcing
 * acceptance of strips the signals had already correctly flagged as busy
 * (a doorframe edge, the start of a dupatta), defeating the whole analysis
 * for photos where genuine safe space is simply narrower than the ideal.
 * The layout adapts its type scale to whatever width actually comes out
 * (see typeScaleForZone) instead of assuming this floor is always met. */
const BASELINE_STRIP_COUNT = 3;
/** Absolute last resort if even the baseline is unsafe — exists only so the
 * layout has SOME width to render into; not a claim that it's safe.
 *
 * Raised from 0.16 (live-tested 2026-09-22): a photo whose calm space fell
 * all the way to that floor produced a genuinely unusable ~80px content
 * column at 1080px canvas width — choppy one-word-per-line wrapping, and
 * worse, several nested elements (icon layout boxes, wrapped-text clip
 * regions) resolved to an exact zero size somewhere in satori's Yoga layout
 * under that narrow a column. satori still emits a zero-area clip mask for
 * those in its SVG output, and resvg's native rasterizer panics trying to
 * construct clip geometry from it — a Rust panic, not a catchable JS error,
 * so it can crash the whole render rather than failing one job gracefully.
 * ~140px content width (0.24 zone fraction) was confirmed safe in the same
 * testing; kept deliberately closer to that proven-safe point than to
 * IDEAL_TEXT_ZONE_FRACTION, since raising this floor also raises how much
 * of the content-aware safety scan's verdict it can override — the whole
 * point of that scan was to stop assuming space is safe, so this floor
 * should only cover the render-crash risk, not quietly reopen the
 * product-coverage risk the scan exists to prevent. Every dimension this
 * layout computes is also defensively floored at a positive minimum (see
 * the Math.max() calls below) as a second, independent guard against the
 * same class of zero-size element regardless of this constant. */
const HARD_MIN_TEXT_ZONE_FRACTION = 0.24;

interface ColumnSignal {
  /** Grayscale contrast within the strip — catches detailed/patterned
   * content (embroidery, mirror-work, a busy background) but, on its own,
   * misses smooth, low-detail product content like plain fabric or skin. */
  stdev: number;
  /** Color distance between the strip's overall dominant tone and a sample
   * from just its own top band (near head height, almost always genuine
   * background/sky/wall in a portrait crop, regardless of x-position).
   * Live-tested (2026-09-22) and confirmed necessary: a pale, smooth dupatta
   * drape scored as "calm" on stdev alone — no internal detail — but its
   * color plainly did not match that same column's background sample. */
  colorShift: number;
}

/** Per-vertical-strip signal across the canvas — cheap, local, no-network
 * proxies for "is there product/subject content here," not just "is there
 * detail here." Every strip costs a couple of small sharp extract+stats
 * calls; STRIP_COUNT of them is fast since it's all in-memory, no I/O. */
async function computeColumnSignals(baseCropped: Buffer, canvas: Canvas): Promise<ColumnSignal[]> {
  const stripWidth = canvas.width / STRIP_COUNT;
  const topBandHeight = Math.max(1, Math.round(canvas.height * 0.14));
  const signals: ColumnSignal[] = [];
  for (let i = 0; i < STRIP_COUNT; i++) {
    const left = Math.floor(i * stripWidth);
    const right = i === STRIP_COUNT - 1 ? canvas.width : Math.floor((i + 1) * stripWidth);
    const width = Math.max(1, right - left);

    // .extract() must be materialized via .toBuffer() before a fresh
    // sharp() instance computes .stats() on it — live-tested (2026-09-22)
    // and confirmed that chaining .extract(...).stats() directly on this
    // sharp/libvips build silently returns stats for the UNCROPPED source
    // instead of the extracted region, which made every strip report
    // identical numbers and made this whole analysis a no-op.
    const stripBuffer = await sharp(baseCropped).extract({ left, top: 0, width, height: canvas.height }).toBuffer();
    const topBandBuffer = await sharp(baseCropped).extract({ left, top: 0, width, height: topBandHeight }).toBuffer();

    const [full, topBand, grey] = await Promise.all([
      sharp(stripBuffer).stats(),
      sharp(topBandBuffer).stats(),
      sharp(stripBuffer).greyscale().stats(),
    ]);

    const colorShift = Math.sqrt(
      (full.dominant.r - topBand.dominant.r) ** 2 +
        (full.dominant.g - topBand.dominant.g) ** 2 +
        (full.dominant.b - topBand.dominant.b) ** 2
    );

    signals.push({ stdev: grey.channels[0].stdev, colorShift });
  }
  return signals;
}

/** Walks in from the left edge, stopping the moment EITHER signal spikes —
 * contrast (a sleeve, a hand, a patterned/embroidered edge) or color-shift
 * (a smooth but differently-toned garment, like plain fabric, that contrast
 * alone misses) — once BASELINE_STRIP_COUNT strips have established what
 * "normal" looks like for this photo.
 *
 * V1.5 (2026-09-23): live-tested against the actual cached hero photo (a
 * real ornate-courtyard generation) with per-strip signals printed raw, and
 * the walk was found to stop almost immediately (~17% of canvas width,
 * only reaching 25% because HARD_MIN_TEXT_ZONE_FRACTION floors it) — not
 * because the model starts there, but because Rajasthani courtyard
 * architecture is genuinely detailed (carved doorframes, a marigold
 * string) well before the model's actual position. The printed data ruled
 * out an initially-planned fix (smoothing isolated spikes with a trailing
 * moving average): stdev stays elevated almost continuously from strip ~4
 * onward, all the way through both the busy background AND the model — the
 * "busy-ness" here isn't a brief isolated blip to smooth past, it's
 * sustained texture in the true background too, so no local per-strip
 * statistic can reliably tell "ornate doorway" apart from "model" on this
 * photo.
 *
 * What the scan CAN'T tell from pixels, the generation prompt already
 * guarantees when compositionHint was used (see lib/model-gen/prompt-sets.
 * ts's compositionClause): "the entire [open] third of the frame must be
 * genuine open, unobstructed space... no part of the model, hair, garment,
 * or any prop crossing into it." That's not a pixel inference, it's an
 * instruction we wrote and can simply trust — so `guaranteedSafeFraction`
 * (passed through from renderCreativeCanvas, sourced from workers/render.
 * ts only when that hint was actually used for this hero photo) sets a
 * FLOOR under the scan's result, wired through Math.max below, independent
 * of whatever the pixel signals say. Photos with no such guarantee (an
 * existing catalogue image, reuse-catalogue path) get no floor here and
 * fall back to the scan + HARD_MIN exactly as before — this must never
 * regress the original "model got covered" bug for that path. */
function resolveSafeTextZoneWidth(signals: ColumnSignal[], canvas: Canvas, guaranteedSafeFraction?: number): number {
  const maxCount = Math.round(MAX_TEXT_ZONE_FRACTION * STRIP_COUNT);
  const hardMinCount = Math.max(1, Math.round(HARD_MIN_TEXT_ZONE_FRACTION * STRIP_COUNT));
  const guaranteedCount = guaranteedSafeFraction ? Math.round(guaranteedSafeFraction * STRIP_COUNT) : 0;
  const COLOR_SHIFT_THRESHOLD = 34;

  let acceptedCount = 0;
  let stdevSum = 0;
  for (let i = 0; i < maxCount && i < signals.length; i++) {
    const { stdev, colorShift } = signals[i];
    const stdevBaseline = acceptedCount > 0 ? stdevSum / acceptedCount : stdev;
    const stdevSpike = stdev > stdevBaseline * 1.5;
    const colorSpike = colorShift > COLOR_SHIFT_THRESHOLD;
    if (acceptedCount >= BASELINE_STRIP_COUNT && (stdevSpike || colorSpike)) break;
    acceptedCount++;
    stdevSum += stdev;
  }

  const safeCount = Math.max(hardMinCount, acceptedCount, guaranteedCount);
  return Math.round((safeCount / STRIP_COUNT) * canvas.width);
}

/** Bidirectional around IDEAL_TEXT_ZONE_FRACTION: scales type DOWN when the
 * safe zone comes out narrower than the pivot (unchanged from V1.3 — a
 * photo that genuinely doesn't leave much calm space still gets compact,
 * still-fitting type instead of overflow/excessive wrapping), and — new in
 * V1.4 — scales type UP when the zone comes out wider than the pivot, which
 * is now possible since resolveSafeTextZoneWidth can discover zones up to
 * MAX_TEXT_ZONE_FRACTION instead of stopping its search at the pivot. This
 * is the actual "fit-to-region" lever: a headline in a genuinely wide calm
 * zone should read larger, not sit at the same base size as a cramped one.
 * Capped at 1.3, not unbounded, for the same reason heightScaleFor caps at
 * 1.35 — a big headline is the goal, not one that dwarfs its own column. */
function typeScaleForZone(textZoneWidth: number, canvas: Canvas): number {
  const ratio = textZoneWidth / (IDEAL_TEXT_ZONE_FRACTION * canvas.width);
  return Math.max(0.72, Math.min(1.3, ratio));
}

// ── Full-bleed layout (hero-editorial, styled-promo) — V1's original tree, unchanged ──

function buildFullBleedElement(canvas: Canvas, template: CreativeTemplate, copy: DeterministicCopy, logoDataUri: string | null) {
  const pad = scale(canvas.width, 48);
  const titleSize = scale(canvas.width, 56);
  const priceSize = scale(canvas.width, 40);
  const badgeSize = scale(canvas.width, 26);
  const ctaSize = scale(canvas.width, 30);
  const logoSize = scale(canvas.width, 72);

  return (
    <div
      style={{
        width: canvas.width,
        height: canvas.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", padding: pad }}>
        {isRegionPresent(template, "logo") && logoDataUri ? (
          <div
            style={{
              display: "flex",
              width: logoSize,
              height: logoSize,
              borderRadius: Math.round(logoSize * 0.22),
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDataUri} alt="" width={logoSize} height={logoSize} style={{ objectFit: "contain" }} />
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: scale(canvas.width, 14),
          padding: `${scale(canvas.width, 220)}px ${pad}px ${pad}px`,
          backgroundImage: "linear-gradient(to bottom, rgba(20,17,16,0) 0%, rgba(20,17,16,0.78) 55%, rgba(20,17,16,0.92) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            color: PAPER,
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.15,
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          {copy.title}
        </div>

        {isRegionPresent(template, "price") && (copy.priceText || copy.discountBadge) ? (
          <div style={{ display: "flex", alignItems: "center", gap: scale(canvas.width, 14) }}>
            {copy.priceText ? (
              <div style={{ display: "flex", color: PAPER, fontSize: priceSize, fontWeight: 700 }}>{copy.priceText}</div>
            ) : null}
            {copy.discountBadge ? (
              <div
                style={{
                  display: "flex",
                  color: PAPER,
                  backgroundColor: ACCENT,
                  fontSize: badgeSize,
                  fontWeight: 700,
                  padding: `${scale(canvas.width, 8)}px ${scale(canvas.width, 14)}px`,
                  borderRadius: scale(canvas.width, 8),
                }}
              >
                {copy.discountBadge}
              </div>
            ) : null}
          </div>
        ) : null}

        {isRegionPresent(template, "cta") ? (
          <div
            style={{
              display: "flex",
              marginTop: scale(canvas.width, 6),
              alignSelf: "flex-start",
              backgroundColor: PAPER,
              color: INK,
              fontSize: ctaSize,
              fontWeight: 700,
              padding: `${scale(canvas.width, 16)}px ${scale(canvas.width, 30)}px`,
              borderRadius: scale(canvas.width, 999),
            }}
          >
            {copy.ctaText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Dense full-bleed layout (promo-benefits) — V1.3 ──

/** Square (1080×1080) is the reference canvas; vertical (1080×1350) and
 * pinterest (1080×1500) have proportionally more vertical room. Live-tested
 * (2026-09-23) and confirmed every font/gap size in this layout was
 * computed from canvas.width alone — identical between square and vertical
 * despite vertical having 25% more height — so the surplus just sat empty
 * below the last element instead of the type actually using the space it
 * was given, exactly the "not even efficient with the space" complaint.
 * Multiplies type/spacing up on taller canvases instead. Capped, not
 * unbounded — a big headline is the goal, not a headline that no longer
 * fits its own column. */
function heightScaleFor(canvas: Canvas): number {
  return Math.min(1.35, canvas.height / 1080);
}

/** Short feather where the crisp product crop meets the blurred panel — a
 * soft depth-of-field-style falloff rather than a hard cut. It's fine for
 * this to blend real (unblurred-vs-blurred) pixels, unlike an earlier
 * attempt's mistake, because both textZoneWidth and this feather now start
 * from a content-verified-safe boundary, not an assumed one. */
function featherWidthFor(canvas: Canvas): number {
  return scale(canvas.width, 90);
}

function buildDensePromoElement(
  canvas: Canvas,
  template: CreativeTemplate,
  copy: DeterministicCopy,
  logoDataUri: string | null,
  accentColor: string | null,
  textZoneWidth: number,
  typeScale: number
) {
  const accentText = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : ACCENT;
  const heightScale = heightScaleFor(canvas);
  // Math.max(1, …) — a second, independent guard (alongside the raised
  // HARD_MIN_TEXT_ZONE_FRACTION floor) against any scaled dimension rounding
  // down to exactly 0, which satori/resvg cannot render safely. typeScale
  // shrinks OR grows type for the width axis (narrow zone vs. wide zone,
  // see typeScaleForZone); heightScale grows it for a tall (extra vertical
  // room) canvas — two independent axes, deliberately multiplied together
  // rather than one constant standing in for both.
  const s = (base1080px: number) => Math.max(1, scale(canvas.width, Math.round(base1080px * typeScale * heightScale)));
  // Gaps get a further, slightly more generous multiplier than type itself
  // — live-tested (2026-09-23): a wide calm zone growing the headline alone
  // still left the surrounding rhythm feeling cramped/left-pinned relative
  // to its own bigger type, so section-to-section and top breathing room
  // grow a bit faster than font sizes do, capped independently of s()'s own
  // 1.3/1.35 ceilings so it doesn't also inflate icon/text sizes.
  const gapScale = Math.min(2.2, typeScale * heightScale);
  const g = (base1080px: number) => Math.max(1, scale(canvas.width, Math.round(base1080px * gapScale)));

  const pad = scale(canvas.width, 50);
  const kickerSize = s(20);
  const titleSize = s(44);
  const featureLabelSize = s(23);
  const featureDescSize = s(18);
  const featureIconSize = s(20);
  const featureIconCircle = s(38);
  const priceSize = s(29);
  const discountSize = s(18);
  const ctaSize = s(24);
  const badgeIconSize = s(20);
  const badgeLabelSize = s(14);
  const logoSize = scale(canvas.width, 66);
  const contentWidth = Math.max(scale(canvas.width, 40), textZoneWidth - pad * 2);
  const featureRowGap = s(13);
  // An EXPLICIT, always-positive computed width — not flexGrow+width:0.
  // Live-tested (2026-09-22): under extreme narrowness (a content-aware
  // textZoneWidth well below ideal), that flex-basis trick could resolve to
  // a literal zero-width box, which satori still emits as a real <rect
  // width="0"> in its SVG output — and resvg's native rasterizer panics
  // trying to construct clip geometry from a zero-size rect ("called
  // Option::unwrap() on a None value" in its Rust geom code), crashing the
  // whole render, not just failing gracefully. Math.max floors this at a
  // usable minimum so it can never reach zero regardless of how narrow the
  // safe zone comes out.
  const featureTextWidth = Math.max(scale(canvas.width, 24), contentWidth - featureIconCircle - featureRowGap);
  const ArrowRightIcon = ICONS["arrow-right"];
  const dividerStyle = { display: "flex" as const, height: 1, width: contentWidth, backgroundColor: "rgba(255,255,255,0.22)" };

  return (
    <div style={{ width: canvas.width, height: canvas.height, display: "flex", flexDirection: "column", fontFamily: "Inter" }}>
      <div style={{ display: "flex", padding: pad }}>
        {isRegionPresent(template, "logo") && logoDataUri ? (
          <div
            style={{
              display: "flex",
              width: logoSize,
              height: logoSize,
              borderRadius: Math.round(logoSize * 0.22),
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDataUri} alt="" width={logoSize} height={logoSize} style={{ objectFit: "contain" }} />
          </div>
        ) : null}
      </div>

      {/* Every element here — kicker, title, features, price+CTA, trust
          badges — is a direct flex child of ONE column with a fixed,
          scaled gap (NOT justifyContent:"space-between" — live-
          tested 2026-09-22 and confirmed that when a narrow, content-aware
          textZoneWidth pushes text into more wrap lines than the available
          height can fit, space-between's slack calculation goes negative
          and rows overlap instead of just flowing past the bottom, which is
          far worse than a less-than-perfectly-distributed layout). White
          text with a ribbon/icon-circle contrast treatment: the panel is a
          blurred, photo-derived background of variable tone again (not a
          flat fill), so text needs a reliable contrast anchor regardless of
          what's underneath at any given point. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          // Group-to-group rhythm (kicker→title→features→price→badges) uses
          // gapScale, not typeScale — this is the "content should sit
          // further from a flush top-left corner when there's real leftover
          // space" lever, separate from font sizing itself (see gapScale's
          // comment above).
          gap: g(22),
          padding: `${g(18)}px ${pad}px ${pad}px`,
          width: contentWidth,
        }}
      >
        {isRegionPresent(template, "kicker") && copy.kicker ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              backgroundColor: accentText,
              borderRadius: scale(canvas.width, 6),
              padding: `${scale(canvas.width, 7)}px ${scale(canvas.width, 16)}px`,
            }}
          >
            <div
              style={{
                display: "flex",
                color: PAPER,
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: kickerSize,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              {copy.kicker}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            color: PAPER,
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.14,
            textShadow: "0 2px 14px rgba(0,0,0,0.45)",
          }}
        >
          {copy.title}
        </div>

        {isRegionPresent(template, "features") && copy.features.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: s(16) }}>
            <div style={dividerStyle} />
            {copy.features.map((f, i) => {
              const Icon = ICONS[f.icon];
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: featureRowGap }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: featureIconCircle,
                      height: featureIconCircle,
                      borderRadius: 999,
                      backgroundColor: accentText,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={featureIconSize} color={PAPER} strokeWidth={2.25} />
                  </div>
                  {/* An explicit width constrains satori to the row's real
                      remaining space before wrapping the description —
                      without it, satori under-measures wrapped text height,
                      so the NEXT feature row starts too early and visibly
                      overlaps this one. See featureTextWidth's own comment
                      for why this must be a computed positive number, never
                      the flexGrow+width:0 trick. */}
                  <div style={{ display: "flex", flexDirection: "column", width: featureTextWidth }}>
                    <div style={{ display: "flex", color: PAPER, fontSize: featureLabelSize, fontWeight: 700 }}>{f.label}</div>
                    <div
                      style={{
                        display: "flex",
                        color: PAPER,
                        opacity: 0.88,
                        fontSize: featureDescSize,
                        fontWeight: 400,
                        textShadow: "0 1px 8px rgba(0,0,0,0.35)",
                      }}
                    >
                      {f.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {isRegionPresent(template, "price") || isRegionPresent(template, "cta") ? (
          <div style={{ display: "flex", flexDirection: "column", gap: s(12) }}>
            <div style={dividerStyle} />
            {isRegionPresent(template, "price") && (copy.priceText || copy.discountBadge) ? (
              // alignItems:"flex-end", not "baseline" — live-tested
              // (2026-09-23) and confirmed satori/Yoga under-measures this
              // row's rendered height under "baseline" alignment once type
              // can scale above 1x (typeScaleForZone's new upper half): the
              // row visibly overlapped the CTA line directly below it in the
              // same flex-start column, the same under-measurement failure
              // class as featureTextWidth's own comment describes, just
              // triggered by alignment mode here instead of a zero-width
              // flex-basis. flex-end still bottom-aligns the two differently
              // sized price/discount texts, which reads the same visually.
              <div style={{ display: "flex", alignItems: "flex-end", gap: s(10) }}>
                {copy.priceText ? (
                  <div
                    style={{
                      display: "flex",
                      // flexShrink:0 — live-tested (2026-09-23) and confirmed
                      // its absence was the real cause of the price/discount
                      // text visibly overlapping: satori/Yoga defaults flex
                      // children to shrinkable, and once this row's computed
                      // available width came out narrower than the combined
                      // natural width of both nowrap text strings, Yoga
                      // shrank the LAYOUT boxes used for gap/positioning —
                      // but the actual glyph paths satori draws are shaped
                      // at full natural size regardless, so the shrunk boxes
                      // and the full-size glyphs disagreed, and the second
                      // string's glyphs landed on top of the first's. Text
                      // that must render at full size (nowrap, a factual
                      // price) must never be allowed to shrink its box.
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      color: PAPER,
                      fontSize: priceSize,
                      fontWeight: 700,
                      textShadow: "0 1px 8px rgba(0,0,0,0.35)",
                    }}
                  >
                    {copy.priceText}
                  </div>
                ) : null}
                {copy.discountBadge ? (
                  <div
                    style={{
                      display: "flex",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      color: "rgba(255,255,255,0.78)",
                      fontSize: discountSize,
                      fontWeight: 600,
                    }}
                  >
                    {copy.discountBadge}
                  </div>
                ) : null}
              </div>
            ) : null}

            {isRegionPresent(template, "cta") ? (
              // Plain text, not a filled pill — the actual click affordance
              // on every platform this renders for (Instagram link sticker,
              // Pinterest/website hyperlink) already lives outside the image
              // itself; a fake button drawn on the pixels risks reading as a
              // real (broken) control instead.
              <div style={{ display: "flex", alignItems: "center", gap: s(8) }}>
                <div
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    color: accentText,
                    fontSize: ctaSize,
                    fontWeight: 700,
                  }}
                >
                  {copy.ctaText}
                </div>
                <ArrowRightIcon size={Math.round(ctaSize * 0.85)} color={accentText} strokeWidth={2.5} />
              </div>
            ) : null}
          </div>
        ) : null}

        {isRegionPresent(template, "trustBadges") && copy.trustBadges.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: s(12) }}>
            <div style={dividerStyle} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: s(14) }}>
              {copy.trustBadges.map((b, i) => {
                const Icon = ICONS[b.icon];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: scale(canvas.width, 7),
                      width: Math.round(contentWidth / 2) - scale(canvas.width, 7),
                    }}
                  >
                    <Icon size={badgeIconSize} color={PAPER} strokeWidth={2} />
                    <div style={{ display: "flex", color: PAPER, opacity: 0.85, fontSize: badgeLabelSize, fontWeight: 600 }}>
                      {b.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface RenderCreativeInput {
  canvas: Canvas;
  template: CreativeTemplate;
  copy: DeterministicCopy;
  /** The resolved, clean hero image bytes — never re-generated here. */
  heroBuffer: Buffer;
  /** Base64 data URI of the retailer's logo, or null when there is none. */
  logoDataUri: string | null;
  /** ClientProfile.accentColor, hex or null — promo-benefits' kicker/CTA
   * text color derives from this, falling back to ACCENT. */
  accentColor: string | null;
  /** Set only when this hero photo was generated with a compositionHint
   * (see lib/model-gen/prompt-sets.ts) that promised a genuinely open,
   * model-free fraction of the frame on the text side — a floor
   * resolveSafeTextZoneWidth can trust directly instead of re-deriving it
   * from pixels. Undefined for any hero photo without that guarantee
   * (reuse-catalogue, product-only) — those keep the pixel-scan-only
   * behavior unchanged. */
  guaranteedSafeFraction?: number;
}

export interface RenderCreativeOutput {
  buffer: Buffer;
  mime: string;
  width: number;
  height: number;
}

export async function renderCreativeCanvas(input: RenderCreativeInput): Promise<RenderCreativeOutput> {
  const fonts = await loadCreativeFonts();
  const { canvas, template } = input;

  // Both paths start from the same "cover"-fit, attention-cropped photo —
  // they only differ in what happens to it before the text overlay goes on.
  const baseCropped = await sharp(input.heroBuffer)
    .rotate()
    .resize(canvas.width, canvas.height, { fit: "cover", position: "attention" })
    .toBuffer();

  if (template.templateFamily === "promo-benefits") {
    // Content-aware boundary: scan the actual photo for where it's calm
    // before deciding how wide the text zone can be — see this file's
    // header for why a fixed fraction can't work in general.
    const signals = await computeColumnSignals(baseCropped, canvas);
    const textZoneWidth = resolveSafeTextZoneWidth(signals, canvas, input.guaranteedSafeFraction);
    const typeScale = typeScaleForZone(textZoneWidth, canvas);
    const featherWidth = featherWidthFor(canvas);

    // Joint layout, not a guillotine cut: earlier revisions sliced a vertical
    // strip off ONE whole-canvas crop, so the product's scale was whatever
    // "cover the full canvas" happened to produce — independent of how wide
    // its actual zone was. A narrow zone left the subject looking small and
    // adrift in unused space; a wide zone could crop it too tight. Instead,
    // crop the ORIGINAL photo directly to the product zone's real dimensions
    // — sharp's "attention" strategy then re-frames (zooms and repositions,
    // both axes) specifically for that box, so the subject fills whatever
    // space it actually has, the way a designer drags and scales a placed
    // photo to its frame rather than generating it pre-sized.
    //
    const productZoneWidth = canvas.width - textZoneWidth;

    // Forcing the crop to cover the FULL canvas height, unconditionally, was
    // the bug on taller canvases two revisions ago: at a WIDE product zone,
    // "cover" fit's attention crop didn't reliably center on the model,
    // cropping into the garment. V1.5 re-tested this directly against the
    // real cached hero photo now that Fix 1 (above) narrows the product
    // zone by widening the text zone — live-tested (2026-09-24) and
    // confirmed the opposite of what was assumed: a NARROWER zone makes
    // "attention" crop MORE reliable, not less (less ambiguous side content
    // to weigh), and calibrated exactly how far it can be pushed by
    // rendering the same photo at several target heights and inspecting
    // each one: safe at a 34.6% required crop (full figure, comfortable
    // margin), still safe at 36.2%, borderline at 38.2% (hairline right at
    // the edge), and clearly cutting her face by 42.6%. MAX_FULL_CROP_
    // FRACTION is set below the borderline point, not at it.
    const MAX_FULL_CROP_FRACTION = 0.35;

    const widthFit = await sharp(input.heroBuffer)
      .rotate()
      .resize({ width: productZoneWidth })
      .toBuffer({ resolveWithObject: true });
    const naturalHeight = widthFit.info.height;
    const requiredCropFraction = Math.max(0, 1 - naturalHeight / canvas.height);

    let productCrop: Buffer;
    let productCropHeight: number;
    if (requiredCropFraction <= MAX_FULL_CROP_FRACTION) {
      // Full height reachable within the calibrated-safe crop budget —
      // closes the gap completely, no synthetic fill needed at all.
      productCrop = await sharp(input.heroBuffer)
        .rotate()
        .resize(productZoneWidth, canvas.height, { fit: "cover", position: "attention" })
        .toBuffer();
      productCropHeight = canvas.height;
    } else {
      // A source photo notably taller-aspect than the target canvas (e.g. a
      // 1792×2400 source into a 1000×1500 pinterest zone) can still exceed
      // the safe crop budget even after Fix 1's narrower zone. Reach as
      // close to full height as the budget safely allows — closing most of
      // the gap — and leave only the genuine remainder to the fill below,
      // rather than either over-cropping the model or leaving the full gap
      // unclosed.
      const targetHeight = Math.round(naturalHeight / (1 - MAX_FULL_CROP_FRACTION));
      productCrop = await sharp(input.heroBuffer)
        .rotate()
        .resize(productZoneWidth, targetHeight, { fit: "cover", position: "attention" })
        .toBuffer();
      productCropHeight = targetHeight;
    }
    // Always top-anchored (V1.5) — retailer feedback (2026-09-24): "stop
    // creating that blur headroom extension as there is still so much
    // empty dead gap at the bottom... shift things down." Any shortfall
    // that survives the crop budget above now falls at the BOTTOM (a
    // "footroom" fill, below) instead of being manufactured at the top.
    const productCropTop = 0;

    const element = buildDensePromoElement(
      canvas,
      template,
      input.copy,
      input.logoDataUri,
      input.accentColor,
      textZoneWidth,
      typeScale
    );
    const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
    const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

    // The panel is derived from the product crop's OWN left edge — stretched
    // to fill the text zone, then blurred — not an independent full-canvas
    // crop. That's what makes it a real "extrapolated" continuation of what's
    // actually displayed next to it (tonally and compositionally anchored to
    // it) rather than a same-toned but disconnected fill, and it avoids the
    // scale mismatch an independently-zoomed panel source would have at the
    // seam.
    // panelBase is stretched to the FULL canvas width AND height — it's the
    // base layer everything else composites onto, so it must cover the whole
    // frame even where the product crop doesn't reach (its left edge always;
    // below it too, when productCropHeight < canvas.height — see footroom
    // below).
    const edgeStripWidth = Math.min(productZoneWidth, scale(canvas.width, 80));
    const edgeStrip = await sharp(productCrop)
      .extract({ left: 0, top: 0, width: edgeStripWidth, height: productCropHeight })
      .toBuffer();
    const panelBaseRaw = await sharp(edgeStrip)
      .resize(canvas.width, canvas.height, { fit: "fill" })
      .blur(scale(canvas.width, 22))
      .toBuffer();

    // Contrast scrim (V1.5): live-tested (2026-09-24) against a bright
    // indoor boutique backdrop and found a real bug every prior test (all
    // dark evening/outdoor courtyard photos) never exposed — panelBase's
    // white text has NO guaranteed contrast against it; it just happens to
    // read fine when the source photo is naturally dark. A bright wall or
    // well-lit interior produces a near-white panel with white text on top
    // of it — close to unreadable. Every reference ad this project has been
    // measured against uses a scrim for exactly this reason. Measure the
    // panel's actual mean luminance and darken it only enough to guarantee
    // legibility (TARGET_MAX_LUMINANCE) — dark photos already under that
    // ceiling get zero scrim, so today's good-looking outdoor renders are
    // untouched; only genuinely bright panels get darkened, and only as
    // much as their own brightness requires.
    const TARGET_MAX_LUMINANCE = 90;
    const MAX_SCRIM_ALPHA = 0.82;
    const panelLuminance = (await sharp(panelBaseRaw).greyscale().stats()).channels[0].mean;
    let panelBase = panelBaseRaw;
    if (panelLuminance > TARGET_MAX_LUMINANCE) {
      const scrimAlpha = Math.min(MAX_SCRIM_ALPHA, 1 - TARGET_MAX_LUMINANCE / panelLuminance);
      const scrim = await sharp({
        create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 20, g: 17, b: 16, alpha: scrimAlpha } },
      })
        .png()
        .toBuffer();
      panelBase = await sharp(panelBaseRaw).composite([{ input: scrim, blend: "over" }]).png().toBuffer();
    }

    // Feather the product crop's own left edge toward transparent so the
    // panel shows through gradually at the seam, instead of a hard cut.
    const horizontalMaskPng = await sharp(buildHorizontalFeatherMask(productZoneWidth, productCropHeight, featherWidth), {
      raw: { width: productZoneWidth, height: productCropHeight, channels: 4 },
    })
      .png()
      .toBuffer();

    let featheredPhoto = await sharp(productCrop)
      .ensureAlpha()
      .composite([{ input: horizontalMaskPng, blend: "dest-in" }])
      .png()
      .toBuffer();

    // Any shortfall that survives MAX_FULL_CROP_FRACTION's budget now falls
    // at the BOTTOM (productCropTop is always 0 — see above), filled from
    // the photo's OWN bottom band — not panelBase's LEFT-edge derivation,
    // which points the wrong physical direction for a vertical gap and
    // produced a visibly disconnected "patch" (retailer feedback,
    // 2026-09-23, repeated 2026-09-24 pointing at the top specifically) —
    // then feather the photo's bottom edge into it the same way the left
    // edge already feathers into the panel, so the seam blends instead of
    // cutting hard. In practice this now rarely triggers at all: the
    // calibrated crop budget above closes the gap completely for square/
    // vertical on the real cached photo, and only pinterest's more extreme
    // height still needs a (much smaller than before) residual fill.
    let footroomComposite: Array<{ input: Buffer; left: number; top: number }> = [];
    if (productCropHeight < canvas.height) {
      const footroomHeight = canvas.height - productCropHeight;
      const bottomBandHeight = Math.min(productCropHeight, scale(canvas.width, 80));
      const bottomBand = await sharp(productCrop)
        .extract({ left: 0, top: productCropHeight - bottomBandHeight, width: productZoneWidth, height: bottomBandHeight })
        .toBuffer();
      const footroomFill = await sharp(bottomBand)
        .resize(productZoneWidth, footroomHeight, { fit: "fill" })
        .blur(scale(canvas.width, 22))
        .toBuffer();
      footroomComposite = [{ input: footroomFill, left: textZoneWidth, top: productCropHeight }];

      const verticalFeatherHeight = Math.min(productCropHeight, featherWidth);
      const verticalMaskPng = await sharp(buildVerticalFeatherMask(productZoneWidth, productCropHeight, verticalFeatherHeight, "bottom"), {
        raw: { width: productZoneWidth, height: productCropHeight, channels: 4 },
      })
        .png()
        .toBuffer();
      featheredPhoto = await sharp(featheredPhoto)
        .composite([{ input: verticalMaskPng, blend: "dest-in" }])
        .png()
        .toBuffer();
    }

    const composited = await sharp(panelBase)
      .composite([
        ...footroomComposite,
        { input: featheredPhoto, left: textZoneWidth, top: productCropTop },
        { input: overlayPng, left: 0, top: 0, blend: "over" },
      ])
      .png()
      .toBuffer();

    const { buffer, mime } = await reencodeGeneratedImage(composited, "image/png");
    return { buffer, mime, width: canvas.width, height: canvas.height };
  }

  // hero-editorial / styled-promo — V1's original path, unchanged.
  const element = buildFullBleedElement(canvas, template, input.copy, input.logoDataUri);
  const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
  const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

  const composited = await sharp(baseCropped)
    .composite([{ input: overlayPng, blend: "over" }])
    .png()
    .toBuffer();

  const { buffer, mime } = await reencodeGeneratedImage(composited, "image/png");
  return { buffer, mime, width: canvas.width, height: canvas.height };
}
