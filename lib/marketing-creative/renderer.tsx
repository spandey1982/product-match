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
 * Two layout modes (see templates.ts's CreativeTemplate.layout):
 * "full-bleed" (hero-editorial, styled-promo) — the photo fills the whole
 * canvas, text overlays via a bottom gradient scrim. "split-panel"
 * (promo-benefits) — a solid-fill text panel on the left, the hero photo
 * confined to the right-hand region instead of covering the canvas.
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
import { lightenHex } from "./color";
import { ICONS } from "./icons";
import { isRegionPresent, type CreativeTemplate } from "./templates";
import type { Canvas, DeterministicCopy } from "./types";

const INK = "#141110";
const PAPER = "#ffffff";
const ACCENT = "#b8622a";

function scale(canvasWidth: number, base1080px: number): number {
  return Math.round(base1080px * (canvasWidth / 1080));
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

// ── Split-panel layout (promo-benefits) ──

/** Fraction of canvas width the solid text panel occupies; the remainder is
 * where the hero photo shows through. */
const PANEL_WIDTH_FRACTION = 0.46;
/** Fraction of canvas height the full-width trust-badge footer occupies. */
const FOOTER_HEIGHT_FRACTION = 0.09;

export function splitPanelGeometry(canvas: Canvas) {
  const panelWidth = Math.round(canvas.width * PANEL_WIDTH_FRACTION);
  const footerHeight = Math.round(canvas.height * FOOTER_HEIGHT_FRACTION);
  return {
    panelWidth,
    photoWidth: canvas.width - panelWidth,
    footerHeight,
    bodyHeight: canvas.height - footerHeight,
  };
}

function buildSplitPanelElement(
  canvas: Canvas,
  template: CreativeTemplate,
  copy: DeterministicCopy,
  logoDataUri: string | null,
  accentColor: string | null
) {
  const { panelWidth, photoWidth, footerHeight, bodyHeight } = splitPanelGeometry(canvas);
  const panelTint = lightenHex(accentColor, 0.85);
  const bannerColor = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : ACCENT;

  const pad = scale(canvas.width, 40);
  const kickerSize = scale(canvas.width, 22);
  const titleSize = scale(canvas.width, 44);
  const featureLabelSize = scale(canvas.width, 24);
  const featureDescSize = scale(canvas.width, 18);
  const priceSize = scale(canvas.width, 34);
  const mrpSize = scale(canvas.width, 18);
  const ctaSize = scale(canvas.width, 22);
  const logoSize = scale(canvas.width, 64);
  const featureIconSize = scale(canvas.width, 22);
  const badgeIconSize = scale(canvas.width, 20);
  const footerLabelSize = scale(canvas.width, 15);

  return (
    <div style={{ width: canvas.width, height: canvas.height, display: "flex", flexDirection: "column", fontFamily: "Inter" }}>
      <div style={{ display: "flex", width: canvas.width, height: bodyHeight }}>
        {/* Left panel — solid fill, opaque, carries every text region. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: panelWidth,
            height: bodyHeight,
            backgroundColor: panelTint,
            padding: pad,
            gap: scale(canvas.width, 16),
          }}
        >
          {isRegionPresent(template, "kicker") && copy.kicker ? (
            <div style={{ display: "flex", color: INK, fontSize: kickerSize, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              {copy.kicker}
            </div>
          ) : null}

          <div style={{ display: "flex", color: INK, fontSize: titleSize, fontWeight: 700, lineHeight: 1.1 }}>{copy.title}</div>

          {isRegionPresent(template, "features") && copy.features.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 10) }}>
              {copy.features.map((f, i) => {
                const Icon = ICONS[f.icon];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: scale(canvas.width, 10) }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: featureIconSize + scale(canvas.width, 12),
                        height: featureIconSize + scale(canvas.width, 12),
                        borderRadius: 999,
                        backgroundColor: bannerColor,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={featureIconSize} color={PAPER} strokeWidth={2.25} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", color: INK, fontSize: featureLabelSize, fontWeight: 700 }}>{f.label}</div>
                      <div style={{ display: "flex", color: INK, opacity: 0.75, fontSize: featureDescSize, fontWeight: 400 }}>
                        {f.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ display: "flex", flexGrow: 1 }} />

          {isRegionPresent(template, "priceBanner") && (copy.priceText || copy.discountBadge) ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: scale(canvas.width, 12),
                alignSelf: "flex-start",
                backgroundColor: bannerColor,
                borderRadius: scale(canvas.width, 14),
                padding: `${scale(canvas.width, 12)}px ${scale(canvas.width, 20)}px`,
              }}
            >
              {copy.priceText ? (
                <div style={{ display: "flex", color: PAPER, fontSize: priceSize, fontWeight: 700 }}>{copy.priceText}</div>
              ) : null}
              {copy.discountBadge ? (
                <div style={{ display: "flex", color: "rgba(255,255,255,0.85)", fontSize: mrpSize, fontWeight: 600 }}>
                  {copy.discountBadge}
                </div>
              ) : null}
            </div>
          ) : null}

          {isRegionPresent(template, "cta") ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                backgroundColor: INK,
                color: PAPER,
                fontSize: ctaSize,
                fontWeight: 700,
                padding: `${scale(canvas.width, 12)}px ${scale(canvas.width, 26)}px`,
                borderRadius: scale(canvas.width, 999),
              }}
            >
              {copy.ctaText}
            </div>
          ) : null}
        </div>

        {/* Right region — deliberately transparent; the hero photo is
            composited here in sharp, underneath this whole overlay. Only
            the logo badge (opaque) renders inside it. */}
        <div style={{ display: "flex", flexDirection: "column", width: photoWidth, height: bodyHeight, padding: pad }}>
          {isRegionPresent(template, "logo") && logoDataUri ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-end",
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
      </div>

      {isRegionPresent(template, "trustBadges") && copy.trustBadges.length > 0 ? (
        <div
          style={{
            display: "flex",
            width: canvas.width,
            height: footerHeight,
            backgroundColor: PAPER,
            alignItems: "center",
            justifyContent: "space-around",
            padding: `0 ${pad}px`,
          }}
        >
          {copy.trustBadges.map((b, i) => {
            const Icon = ICONS[b.icon];
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: scale(canvas.width, 4) }}>
                <Icon size={badgeIconSize} color={INK} strokeWidth={2} />
                <div style={{ display: "flex", color: INK, fontSize: footerLabelSize, fontWeight: 600, textAlign: "center" }}>
                  {b.label}
                </div>
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
  /** ClientProfile.accentColor, hex or null — panel tint (split-panel) and
   * price-banner color derive from this, falling back to ACCENT. */
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

  if (template.layout === "split-panel") {
    const element = buildSplitPanelElement(canvas, template, input.copy, input.logoDataUri, input.accentColor);
    const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
    const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

    const { panelWidth, photoWidth, bodyHeight } = splitPanelGeometry(canvas);
    const panelTint = lightenHex(input.accentColor, 0.85);

    const resizedPhoto = await sharp(input.heroBuffer)
      .rotate()
      .resize(photoWidth, bodyHeight, { fit: "cover", position: "attention" })
      .toBuffer();

    const composited = await sharp({
      create: { width: canvas.width, height: canvas.height, channels: 4, background: panelTint },
    })
      .composite([
        { input: resizedPhoto, left: panelWidth, top: 0 },
        { input: overlayPng, left: 0, top: 0, blend: "over" },
      ])
      .png()
      .toBuffer();

    const { buffer, mime } = await reencodeGeneratedImage(composited, "image/png");
    return { buffer, mime, width: canvas.width, height: canvas.height };
  }

  // "full-bleed" — V1's original path, unchanged.
  const element = buildFullBleedElement(canvas, template, input.copy, input.logoDataUri);
  const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
  const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: canvas.width } }).render().asPng();

  const composited = await sharp(input.heroBuffer)
    .rotate()
    .resize(canvas.width, canvas.height, { fit: "cover", position: "attention" })
    .composite([{ input: overlayPng, blend: "over" }])
    .png()
    .toBuffer();

  const { buffer, mime } = await reencodeGeneratedImage(composited, "image/png");
  return { buffer, mime, width: canvas.width, height: canvas.height };
}
