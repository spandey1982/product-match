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
 * price+CTA, trust badges) under one justifyContent:"space-between", each
 * separated by a hairline divider, so the whole available height is used
 * the way a real print ad distributes copy — not clustered, not centered as
 * one block. Text is white again (not dark ink), since the panel is once
 * more a photo-derived background of variable tone, not a flat light fill.
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

const STRIP_COUNT = 24;
const IDEAL_TEXT_ZONE_FRACTION = 0.42;
/** A small baseline-establishing count, NOT a content-overriding floor —
 * live-tested (2026-09-22) and confirmed a large "minimum" here was forcing
 * acceptance of strips the signals had already correctly flagged as busy
 * (a doorframe edge, the start of a dupatta), defeating the whole analysis
 * for photos where genuine safe space is simply narrower than the ideal.
 * The layout adapts its type scale to whatever width actually comes out
 * (see densityScaleFor) instead of assuming this floor is always met. */
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
 * "normal" looks like for this photo. Never more than IDEAL_TEXT_ZONE_
 * FRACTION's worth even if the photo stays calm the whole way — this is a
 * text panel, not a license to shrink the product's share of the frame. */
function resolveSafeTextZoneWidth(signals: ColumnSignal[], canvas: Canvas): number {
  const idealCount = Math.round(IDEAL_TEXT_ZONE_FRACTION * STRIP_COUNT);
  const hardMinCount = Math.max(1, Math.round(HARD_MIN_TEXT_ZONE_FRACTION * STRIP_COUNT));
  const COLOR_SHIFT_THRESHOLD = 34;

  let acceptedCount = 0;
  let stdevSum = 0;
  for (let i = 0; i < idealCount && i < signals.length; i++) {
    const { stdev, colorShift } = signals[i];
    const stdevBaseline = acceptedCount > 0 ? stdevSum / acceptedCount : stdev;
    const stdevSpike = stdev > stdevBaseline * 1.5;
    const colorSpike = colorShift > COLOR_SHIFT_THRESHOLD;
    if (acceptedCount >= BASELINE_STRIP_COUNT && (stdevSpike || colorSpike)) break;
    acceptedCount++;
    stdevSum += stdev;
  }

  const safeCount = Math.max(hardMinCount, acceptedCount);
  return Math.round((safeCount / STRIP_COUNT) * canvas.width);
}

/** Scales type down when the safe zone comes out narrower than the ideal —
 * so a photo that genuinely doesn't leave much calm space gets compact,
 * still-fitting type instead of overflow/excessive wrapping. Never scales
 * up past 1 when the zone is at or above ideal. */
function densityScaleFor(textZoneWidth: number, canvas: Canvas): number {
  const ratio = textZoneWidth / (IDEAL_TEXT_ZONE_FRACTION * canvas.width);
  return Math.max(0.72, Math.min(1, ratio));
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
  densityScale: number
) {
  const accentText = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : ACCENT;
  // Math.max(1, …) — a second, independent guard (alongside the raised
  // HARD_MIN_TEXT_ZONE_FRACTION floor) against any density-scaled dimension
  // rounding down to exactly 0, which satori/resvg cannot render safely.
  const s = (base1080px: number) => Math.max(1, scale(canvas.width, Math.round(base1080px * densityScale)));

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
  const featureRowGap = scale(canvas.width, 13);
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
          density-scaled gap (NOT justifyContent:"space-between" — live-
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
          gap: s(22),
          padding: `${s(18)}px ${pad}px ${pad}px`,
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
          <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 16) }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 12) }}>
            <div style={dividerStyle} />
            {isRegionPresent(template, "price") && (copy.priceText || copy.discountBadge) ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: scale(canvas.width, 10) }}>
                {copy.priceText ? (
                  <div
                    style={{
                      display: "flex",
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
              <div style={{ display: "flex", alignItems: "center", gap: scale(canvas.width, 8) }}>
                <div style={{ display: "flex", whiteSpace: "nowrap", color: accentText, fontSize: ctaSize, fontWeight: 700 }}>
                  {copy.ctaText}
                </div>
                <ArrowRightIcon size={Math.round(ctaSize * 0.85)} color={accentText} strokeWidth={2.5} />
              </div>
            ) : null}
          </div>
        ) : null}

        {isRegionPresent(template, "trustBadges") && copy.trustBadges.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 12) }}>
            <div style={dividerStyle} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: scale(canvas.width, 14) }}>
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
    const textZoneWidth = resolveSafeTextZoneWidth(signals, canvas);
    const densityScale = densityScaleFor(textZoneWidth, canvas);
    const featherWidth = featherWidthFor(canvas);

    const element = buildDensePromoElement(
      canvas,
      template,
      input.copy,
      input.logoDataUri,
      input.accentColor,
      textZoneWidth,
      densityScale
    );
    const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
    const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

    // The panel is a blurred copy of the SAME verified-safe region — real
    // photo tones/texture, not an arbitrary fill, and safe to blur because
    // the boundary is now content-verified rather than assumed.
    const blurredBase = await sharp(baseCropped).blur(scale(canvas.width, 26)).toBuffer();

    // The product crop starts AT textZoneWidth, feathering in toward fully
    // opaque so the blur→sharp change reads as a soft falloff.
    const cropStartX = textZoneWidth;
    const sharpRegionWidth = canvas.width - cropStartX;
    const photoRegion = await sharp(baseCropped)
      .extract({ left: cropStartX, top: 0, width: sharpRegionWidth, height: canvas.height })
      .toBuffer();

    const maskPng = await sharp(buildHorizontalFeatherMask(sharpRegionWidth, canvas.height, featherWidth), {
      raw: { width: sharpRegionWidth, height: canvas.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const featheredPhoto = await sharp(photoRegion)
      .ensureAlpha()
      .composite([{ input: maskPng, blend: "dest-in" }])
      .png()
      .toBuffer();

    const composited = await sharp(blurredBase)
      .composite([
        { input: featheredPhoto, left: cropStartX, top: 0 },
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
