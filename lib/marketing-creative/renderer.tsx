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
 * V1.2's solid-fill split-panel drew retailer feedback (hard seam, a
 * disconnected trust-badge footer, dead space) — fixed by moving to a
 * single full-canvas "cover" crop with a left-to-right gradient, same as
 * this file's first V1.3 pass. But that in turn drew a second, sharper
 * round of feedback: with no dedicated zone for the text, the content
 * column landed on top of the model/garment on some renders, and the
 * garment — the actual thing being sold — is exactly what a viewer must be
 * able to see clearly for the creative to do its job.
 *
 * buildDensePromoElement + renderCreativeCanvas's promo-benefits branch
 * enforce a real two-zone geometry instead of hoping sharp's "attention"
 * crop happens to leave room: a text zone and a product zone (see
 * denseZoneGeometry), deliberately off-center rather than dead-center or
 * pushed to the edge. The product zone is a crisp crop of the hero photo;
 * the text zone is the SAME underlying crop, blurred, with a feathered
 * (gradually-blurring, not a hard cut) transition between them.
 *
 * That transition band's placement matters and was wrong in the first cut
 * of this design: it ended exactly at the text zone's boundary, which means
 * its second half was already blending real (unblurred) product pixels
 * with blur — visible as a soft/blurred sliver of the model whenever her
 * silhouette reached that far left, live-tested and confirmed by the
 * retailer. Fixed by starting the feather band AT the text-zone boundary
 * and running it rightward from there — the entire text zone is now
 * guaranteed pure blur with zero product pixels composited into it at any
 * opacity, and the transition itself lives entirely in the buffer between
 * the two zones where nothing needs to be legible.
 *
 * Content layout also moved from one vertically-centered cluster to a
 * genuine top-to-bottom spread (space-between, not center) plus a
 * full-width bottom band for trust badges spanning both zones — so the
 * composition uses the frame the way a real print ad does (compare
 * research/catalogue-to-campaign.html's reference examples) instead of
 * reading as a block of text pasted over a photo.
 *
 * It also drops the promo-benefits CTA's filled-pill styling (a fake button
 * an Instagram/Pinterest viewer might mistake for something tappable, when
 * the actual click path is the platform's own link affordance) and the
 * price banner's solid accent fill (de-emphasized to an inline text line,
 * present without dominating) — a colored kicker ribbon and icon-circle
 * badges stayed/returned though, since those are informational labels, not
 * fake controls, and give text reliable contrast against a photo whose tone
 * varies underneath it.
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
 * holds at 255 for the rest — used as a `dest-in` mask so a sharp crop
 * fades in gradually from a blurred layer underneath it, rather than
 * cutting in abruptly at a hard edge. */
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

/** Fraction of canvas width reserved for text — content is confined inside
 * this, with padding, and it is the boundary the blur→sharp feather band
 * starts AT (never before), so nothing in the text zone is ever partially
 * sharp. The product's effective fully-opaque region starts even further
 * right (textZoneWidth + featherWidth), landing its visual center around
 * the canvas's +0.4 to +0.5 mark (center = 0, edges = ±1) — off to one
 * side, never dead-center, never pushed to the edge. */
const TEXT_ZONE_FRACTION = 0.4;

export function denseZoneGeometry(canvas: Canvas) {
  const textZoneWidth = Math.round(canvas.width * TEXT_ZONE_FRACTION);
  // Transition band, entirely AFTER textZoneWidth — a buffer strip with no
  // text in it, so blending real pixels with blur there is harmless.
  const featherWidth = scale(canvas.width, 110);
  // Full-width strip at the very bottom for trust badges — spans both
  // zones so the composition reads as one frame, not two stitched halves.
  const footerHeight = Math.round(canvas.height * 0.1);
  return { textZoneWidth, featherWidth, footerHeight };
}

function buildDensePromoElement(
  canvas: Canvas,
  template: CreativeTemplate,
  copy: DeterministicCopy,
  logoDataUri: string | null,
  accentColor: string | null
) {
  const accentText = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : ACCENT;

  const pad = scale(canvas.width, 52);
  const kickerSize = scale(canvas.width, 21);
  const titleSize = scale(canvas.width, 47);
  const featureLabelSize = scale(canvas.width, 24);
  const featureDescSize = scale(canvas.width, 19);
  const featureIconSize = scale(canvas.width, 20);
  const featureIconCircle = scale(canvas.width, 40);
  const priceSize = scale(canvas.width, 29);
  const discountSize = scale(canvas.width, 18);
  const ctaSize = scale(canvas.width, 25);
  const badgeIconSize = scale(canvas.width, 21);
  const badgeLabelSize = scale(canvas.width, 15);
  const logoSize = scale(canvas.width, 68);
  const { textZoneWidth, footerHeight } = denseZoneGeometry(canvas);
  const contentWidth = textZoneWidth - pad * 2;
  const ArrowRightIcon = ICONS["arrow-right"];

  return (
    <div
      style={{
        width: canvas.width,
        height: canvas.height,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter",
        // A light contrast scrim confined to roughly the text zone — the
        // actual separation from the product now comes from the blur in
        // renderCreativeCanvas's compositing step, not from darkening, so
        // this can stay much lighter than a scrim carrying the whole job.
        backgroundImage:
          "linear-gradient(to right, rgba(20,17,16,0.5) 0%, rgba(20,17,16,0.32) 55%, rgba(20,17,16,0.05) 78%, rgba(20,17,16,0) 90%)",
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

      {/* Every element here — kicker, title, features, price+CTA — is a
          direct flex child of ONE column with justifyContent:"space-between",
          so the gaps distribute evenly across the whole available height.
          An earlier version grouped these into two clusters (top block,
          price/CTA block) with space-between only between the two groups,
          which just relocated the "clustered" problem into one big gap in
          the middle instead of spreading content the way a real print ad
          does — this flat structure is what actually fixes it. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "space-between",
          padding: `0 ${pad}px`,
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
            textShadow: "0 2px 14px rgba(0,0,0,0.4)",
          }}
        >
          {copy.title}
        </div>

        {isRegionPresent(template, "features") && copy.features.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 16) }}>
            {copy.features.map((f, i) => {
              const Icon = ICONS[f.icon];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: scale(canvas.width, 14) }}>
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
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", color: PAPER, fontSize: featureLabelSize, fontWeight: 700 }}>{f.label}</div>
                    <div style={{ display: "flex", color: PAPER, fontSize: featureDescSize, fontWeight: 400 }}>
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
            {isRegionPresent(template, "price") && (copy.priceText || copy.discountBadge) ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: scale(canvas.width, 10) }}>
                {copy.priceText ? (
                  <div
                    style={{
                      display: "flex",
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
                  <div style={{ display: "flex", color: "rgba(255,255,255,0.78)", fontSize: discountSize, fontWeight: 600 }}>
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
                <div style={{ display: "flex", color: accentText, fontSize: ctaSize, fontWeight: 700 }}>{copy.ctaText}</div>
                <ArrowRightIcon size={Math.round(ctaSize * 0.85)} color={accentText} strokeWidth={2.5} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Full-width footer, spanning both the text and product zones — the
          composition's bottom edge ties the whole frame together instead of
          the trust badges reading as content confined to just one side. */}
      {isRegionPresent(template, "trustBadges") && copy.trustBadges.length > 0 ? (
        <div
          style={{
            display: "flex",
            width: canvas.width,
            height: footerHeight,
            alignItems: "center",
            justifyContent: "space-around",
            padding: `0 ${pad}px`,
            backgroundImage: "linear-gradient(to top, rgba(20,17,16,0.55) 0%, rgba(20,17,16,0) 100%)",
          }}
        >
          {copy.trustBadges.map((b, i) => {
            const Icon = ICONS[b.icon];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: scale(canvas.width, 7) }}>
                <Icon size={badgeIconSize} color={PAPER} strokeWidth={2} />
                <div style={{ display: "flex", color: PAPER, fontSize: badgeLabelSize, fontWeight: 600 }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      ) : null}
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
    const element = buildDensePromoElement(canvas, template, input.copy, input.logoDataUri, input.accentColor);
    const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
    const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

    const { textZoneWidth, featherWidth } = denseZoneGeometry(canvas);

    // The text zone is the SAME crop, blurred — an "extrapolated" continuation
    // of the product photo rather than an unrelated fill, so there's no seam
    // in color or lighting, only a change in focus.
    const blurredBase = await sharp(baseCropped).blur(scale(canvas.width, 30)).toBuffer();

    // The product zone is a crisp sub-crop of that exact same base image
    // (guaranteed pixel-aligned with the blurred layer, no parallax jump at
    // the boundary), feathered in from fully transparent to fully opaque
    // across featherWidth so it fades in out of the blur gradually instead
    // of cutting in at a hard edge. Starts AT textZoneWidth, never before —
    // the text zone itself must never composite any sharp pixels, at any
    // opacity, or product content bleeds through as a visible soft blur
    // wherever the subject's silhouette happens to reach that far left.
    const cropStartX = textZoneWidth;
    const sharpRegionWidth = canvas.width - cropStartX;
    const sharpRegion = await sharp(baseCropped)
      .extract({ left: cropStartX, top: 0, width: sharpRegionWidth, height: canvas.height })
      .toBuffer();

    const maskPng = await sharp(buildHorizontalFeatherMask(sharpRegionWidth, canvas.height, featherWidth), {
      raw: { width: sharpRegionWidth, height: canvas.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const featheredSharpRegion = await sharp(sharpRegion)
      .ensureAlpha()
      .composite([{ input: maskPng, blend: "dest-in" }])
      .png()
      .toBuffer();

    const composited = await sharp(blurredBase)
      .composite([
        { input: featheredSharpRegion, left: cropStartX, top: 0 },
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
