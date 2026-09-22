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
 * Two earlier attempts both derived the text zone FROM the hero photo
 * itself — first a plain gradient over one full-canvas crop, then a blurred
 * copy of that same crop with a feathered blur→sharp transition. Both kept
 * reintroducing the same class of defect (a visible soft/blurred sliver of
 * the model wherever her silhouette reached into the text zone), because
 * any technique that shares real product pixels with the text zone has to
 * get the boundary exactly right for every hero photo, and "attention"-crop
 * gives no guarantee about where the subject's silhouette actually ends.
 *
 * V1.3's current design (this revision) sidesteps the whole problem: the
 * text zone is a FLAT, solid-color panel — not derived from the photo at
 * all, so there is no shared pixel data and therefore no way for product
 * content to bleed into it, blurred or otherwise. The panel's color is the
 * hero photo's own dominant tone (via sharp's `.stats().dominant`, lightened
 * toward white), so it still harmonizes with the photo instead of looking
 * like an arbitrary color choice — the retailer's own reference example for
 * this approach uses the same trick (a plain panel color-matched to the
 * photo's wall/backdrop tone). A short feather where the crisp product crop
 * meets the panel is still applied, but it now fades real photo pixels
 * toward the FLAT PANEL COLOR (a vignette), never toward a blurred copy of
 * the subject — so even if the model's edge reaches into that band, the
 * result reads as an intentional soft vignette, not a rendering defect.
 *
 * denseZoneGeometry still defines a text zone and product zone, deliberately
 * off-center rather than dead-center or pushed to the edge. Content is a
 * flat column of peer elements (kicker, title, features, price+CTA, trust
 * badges) under one justifyContent:"space-between", each separated by a
 * hairline divider, so the whole available height is used the way a real
 * print ad distributes copy — not clustered, not centered as one block.
 * Text is dark ink now (not white), since a light flat panel doesn't need
 * the shadow/translucency tricks a photo background did for contrast.
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

/** Mixes an {r,g,b} triple toward white by `amount` (0-1) and returns a hex
 * string — used to turn the hero photo's dominant color into a light panel
 * tint that harmonizes with it, rather than picking an arbitrary color. */
function lightenRgbToHex(rgb: { r: number; g: number; b: number }, amount: number): string {
  const mix = (channel: number) => Math.max(0, Math.min(255, Math.round(channel + (255 - channel) * amount)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(rgb.r))}${toHex(mix(rgb.g))}${toHex(mix(rgb.b))}`;
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

/** Fraction of canvas width reserved for the flat text panel — content is
 * confined inside this, with padding. It's also the boundary the product
 * crop's left-edge vignette starts AT (never before), so the panel itself
 * never has any photo pixels composited into it, faded or otherwise. The
 * product's fully-opaque region starts a little further right still
 * (textZoneWidth + featherWidth), landing its visual center around the
 * canvas's +0.4 to +0.5 mark (center = 0, edges = ±1) — off to one side,
 * never dead-center, never pushed to the edge. */
const TEXT_ZONE_FRACTION = 0.42;

export function denseZoneGeometry(canvas: Canvas) {
  const textZoneWidth = Math.round(canvas.width * TEXT_ZONE_FRACTION);
  // Short vignette where the crisp product crop fades toward the panel
  // color — this is NOT a blur transition (there is no blur anywhere in
  // this layout anymore), just an alpha fade of real photo pixels into a
  // matching flat color, so it reads as an edge treatment, not a defect.
  const featherWidth = scale(canvas.width, 60);
  return { textZoneWidth, featherWidth };
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
  const kickerSize = scale(canvas.width, 20);
  const titleSize = scale(canvas.width, 46);
  const featureLabelSize = scale(canvas.width, 23);
  const featureDescSize = scale(canvas.width, 18);
  const featureIconSize = scale(canvas.width, 22);
  const priceSize = scale(canvas.width, 29);
  const discountSize = scale(canvas.width, 18);
  const ctaSize = scale(canvas.width, 24);
  const badgeIconSize = scale(canvas.width, 20);
  const badgeLabelSize = scale(canvas.width, 14);
  const logoSize = scale(canvas.width, 66);
  const { textZoneWidth } = denseZoneGeometry(canvas);
  const contentWidth = textZoneWidth - pad * 2;
  const ArrowRightIcon = ICONS["arrow-right"];
  const dividerStyle = { display: "flex" as const, height: 1, width: contentWidth, backgroundColor: "rgba(20,17,16,0.15)" };

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
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(20,17,16,0.1)",
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
          badges — is a direct flex child of ONE column with
          justifyContent:"space-between", so gaps distribute evenly across
          the whole available height instead of clustering. Dark ink text
          throughout: the panel behind this is now a flat, light,
          photo-color-matched fill (painted by renderCreativeCanvas as the
          base layer, not drawn here), so there's no variable-photo-tone
          contrast problem left to solve with translucency or shadows. */}
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
              color: accentText,
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: kickerSize,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            {copy.kicker}
          </div>
        ) : null}

        <div style={{ display: "flex", color: INK, fontSize: titleSize, fontWeight: 700, lineHeight: 1.14 }}>{copy.title}</div>

        {isRegionPresent(template, "features") && copy.features.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 16) }}>
            <div style={dividerStyle} />
            {copy.features.map((f, i) => {
              const Icon = ICONS[f.icon];
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: scale(canvas.width, 13) }}>
                  <div style={{ display: "flex", marginTop: scale(canvas.width, 2) }}>
                    <Icon size={featureIconSize} color={accentText} strokeWidth={2.25} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", color: INK, fontSize: featureLabelSize, fontWeight: 700 }}>{f.label}</div>
                    <div style={{ display: "flex", color: INK, opacity: 0.72, fontSize: featureDescSize, fontWeight: 400 }}>
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
                  <div style={{ display: "flex", color: INK, fontSize: priceSize, fontWeight: 700 }}>{copy.priceText}</div>
                ) : null}
                {copy.discountBadge ? (
                  <div style={{ display: "flex", color: "rgba(20,17,16,0.55)", fontSize: discountSize, fontWeight: 600 }}>
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
                    <Icon size={badgeIconSize} color={accentText} strokeWidth={2} />
                    <div style={{ display: "flex", color: INK, opacity: 0.85, fontSize: badgeLabelSize, fontWeight: 600 }}>
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
    // The panel's flat fill is the hero photo's own dominant color,
    // lightened — harmonizes with the photo without sharing any of its
    // actual pixels, which is what makes this immune to the blur-bleed
    // defect the two earlier compositing strategies both had.
    const { dominant } = await sharp(baseCropped).stats();
    const panelColor = lightenRgbToHex(dominant, 0.74);

    const element = buildDensePromoElement(canvas, template, input.copy, input.logoDataUri, input.accentColor);
    const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
    const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

    const { textZoneWidth, featherWidth } = denseZoneGeometry(canvas);

    // The product crop starts AT textZoneWidth, never before — the panel
    // must never have any photo pixels composited into it, faded or not.
    const cropStartX = textZoneWidth;
    const sharpRegionWidth = canvas.width - cropStartX;
    const photoRegion = await sharp(baseCropped)
      .extract({ left: cropStartX, top: 0, width: sharpRegionWidth, height: canvas.height })
      .toBuffer();

    // Short alpha fade on the crop's own left edge (toward transparent, so
    // the flat panel color shows through underneath) — a vignette, not a
    // blur: it softens the seam without ever showing a blurred rendition of
    // the subject, because there's nothing blurred anywhere in this layout.
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

    const composited = await sharp({
      create: { width: canvas.width, height: canvas.height, channels: 4, background: panelColor },
    })
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
