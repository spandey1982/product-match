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
 * layout) — the photo fills the whole canvas, text overlays via a gradient
 * scrim, never a separate solid-fill panel. hero-editorial/styled-promo use
 * a bottom-up scrim (buildFullBleedElement, V1's original tree, untouched).
 * promo-benefits used a split-panel geometry through V1.2 — a solid-fill
 * text panel + the photo confined to the remaining width — but retailer
 * feedback on the first live render flagged three problems with that: a
 * hard seam between panel and photo, a disconnected white trust-badge
 * footer strip, and dead space below the panel's content. V1.3's
 * buildDensePromoElement replaces it with the same technique the /shop PDP's
 * "Pairs beautifully with" carousel slide already uses (components/product/
 * AdditionalInfoSlide.tsx) — one photo, a left-to-right gradient, content
 * vertically centered on top — so the whole canvas reads as one image
 * instead of two stitched zones. It also drops the promo-benefits CTA's
 * filled-pill styling (a fake button an Instagram/Pinterest viewer might
 * mistake for something tappable, when the actual click path is the
 * platform's own link affordance) and the price banner's solid accent fill
 * (de-emphasized to an inline text line, present without dominating).
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
//
// Same compositing primitive as buildFullBleedElement below (one photo,
// resized to cover the canvas, one Satori overlay composited on top) — the
// only difference from that function is a left-to-right scrim instead of a
// bottom-up one, and a richer, vertically-centered content column. See this
// file's header for why V1.2's separate solid-panel geometry was dropped.

function buildDensePromoElement(
  canvas: Canvas,
  template: CreativeTemplate,
  copy: DeterministicCopy,
  logoDataUri: string | null,
  accentColor: string | null
) {
  const accentText = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : ACCENT;

  const pad = scale(canvas.width, 48);
  const kickerSize = scale(canvas.width, 20);
  const titleSize = scale(canvas.width, 46);
  const featureLabelSize = scale(canvas.width, 23);
  const featureDescSize = scale(canvas.width, 17);
  const featureIconSize = scale(canvas.width, 21);
  const priceSize = scale(canvas.width, 28);
  const discountSize = scale(canvas.width, 17);
  const ctaSize = scale(canvas.width, 25);
  const badgeIconSize = scale(canvas.width, 19);
  const badgeLabelSize = scale(canvas.width, 13);
  const logoSize = scale(canvas.width, 68);
  const contentWidth = Math.round(canvas.width * 0.6);
  const ArrowRightIcon = ICONS["arrow-right"];

  return (
    <div
      style={{
        width: canvas.width,
        height: canvas.height,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter",
        // Left-to-right, same technique as components/product/
        // AdditionalInfoSlide.tsx's "Pairs beautifully with" slide — the
        // SAME photo darkens toward the text side rather than a separate
        // solid panel butting up against it, so the canvas reads as one
        // continuous image.
        backgroundImage:
          "linear-gradient(to right, rgba(20,17,16,0.86) 0%, rgba(20,17,16,0.62) 42%, rgba(20,17,16,0.18) 74%, rgba(20,17,16,0) 92%)",
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

      {/* Vertically centered across whatever height remains below the logo
          row — fills the canvas by design (generous gaps) instead of
          leaving dead space the way a fixed-height bottom block did. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
          padding: `0 ${pad}px ${pad}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: contentWidth, gap: scale(canvas.width, 16) }}>
          {isRegionPresent(template, "kicker") && copy.kicker ? (
            <div
              style={{
                display: "flex",
                color: accentText,
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: kickerSize,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {copy.kicker}
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
            <div style={{ display: "flex", flexDirection: "column", gap: scale(canvas.width, 9) }}>
              {copy.features.map((f, i) => {
                const Icon = ICONS[f.icon];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: scale(canvas.width, 10) }}>
                    <div style={{ display: "flex", marginTop: scale(canvas.width, 3) }}>
                      <Icon size={featureIconSize} color={PAPER} strokeWidth={2} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          display: "flex",
                          color: PAPER,
                          fontSize: featureLabelSize,
                          fontWeight: 700,
                          textShadow: "0 1px 8px rgba(0,0,0,0.35)",
                        }}
                      >
                        {f.label}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          color: PAPER,
                          opacity: 0.82,
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
                <div style={{ display: "flex", color: "rgba(255,255,255,0.72)", fontSize: discountSize, fontWeight: 600 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: scale(canvas.width, 8), marginTop: scale(canvas.width, 4) }}>
              <div style={{ display: "flex", color: accentText, fontSize: ctaSize, fontWeight: 700 }}>{copy.ctaText}</div>
              <ArrowRightIcon size={Math.round(ctaSize * 0.85)} color={accentText} strokeWidth={2.5} />
            </div>
          ) : null}

          {isRegionPresent(template, "trustBadges") && copy.trustBadges.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                width: contentWidth,
                gap: scale(canvas.width, 10),
                marginTop: scale(canvas.width, 10),
              }}
            >
              {copy.trustBadges.map((b, i) => {
                const Icon = ICONS[b.icon];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: scale(canvas.width, 6),
                      width: Math.round(contentWidth / 2) - scale(canvas.width, 5),
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
          ) : null}
        </div>
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

  // All three families composite the same way now — one photo resized to
  // cover the canvas, one Satori overlay on top — they only differ in which
  // JSX tree builds that overlay.
  const element =
    template.templateFamily === "promo-benefits"
      ? buildDensePromoElement(canvas, template, input.copy, input.logoDataUri, input.accentColor)
      : buildFullBleedElement(canvas, template, input.copy, input.logoDataUri);

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
