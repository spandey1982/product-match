/**
 * Renders EndCardContent into a static 720x1280 PNG via Satori + resvg —
 * replaces the hand-built-SVG end-card-image.ts (research/
 * presenter-reel-content-strategy.html's "migrate to Satori" decision,
 * 2026-09-28). Same rendering pipeline lib/marketing-creative/renderer.tsx
 * uses (satori() -> SVG string -> new Resvg().render().asPng()), so this
 * gets a real flexbox layout engine instead of manually-computed y
 * coordinates, and the title font switches between Fraunces and Playfair
 * Display per EndCardContent.mood (fonts.ts) — everything else stays
 * Inter, same as before.
 *
 * 720x1280 matches veo-presenter-provider.ts's fixed output dimensions —
 * this composites directly onto the blurred settled frame in
 * video-finishing.ts with no scaling.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { ICONS } from "@/lib/marketing-creative/icons";
import { loadPresenterReelFonts } from "./fonts";
import type { EndCardContent } from "./end-card";

const WIDTH = 720;
const HEIGHT = 1280;
/** Nothing renders below this line — reserved so burned-in text is never covered by a video player's own progress-bar/controls chrome (confirmed real complaint, 2026-09-29). */
const CONTENT_BOTTOM = HEIGHT * 0.75;

const TITLE_FONT: Record<EndCardContent["mood"], string> = {
  heritage: "Playfair Display",
  contemporary: "Fraunces",
};

function formatPrice(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * The card sits on the blurred product photo itself, not a flat fill, so a
 * plain text color can end up close to the backdrop's own tone in exactly
 * the region it happens to cover — confirmed as a real legibility issue
 * (2026-09-29). A first fix (a hard WebkitTextStroke + double glow on every
 * glyph) technically worked but read as tacky/shiny — the opposite problem.
 * This is the second, user-approved pass: a full-bleed gradient scrim
 * spanning the whole frame edge to edge, fading up from the bottom, rather
 * than a discrete rounded/margined panel sitting behind just the text block
 * (that read as an obviously separate overlaid layer, the same complaint in
 * a different form). Glyphs themselves are untouched — no stroke, no
 * per-letter shadow — the gradient alone does the contrast work, the same
 * technique lower-thirds and story captions use. Gradient direction/stops
 * are keyed off contrast (textOnDark's opposite polarity), same as the
 * first attempt, still never an arbitrary or backdrop-derived color.
 */
export async function renderEndCardPng(content: EndCardContent, accentHex: string, textOnDark: boolean): Promise<Buffer> {
  const fonts = await loadPresenterReelFonts();
  const titleFont = TITLE_FONT[content.mood];
  const textColor = textOnDark ? "#ffffff" : "#161616";
  const mutedColor = textOnDark ? "#e8e4dc" : "#3a352c";
  const contrast = textOnDark ? "#000000" : "#ffffff";
  const CheckIcon = ICONS["check-circle"];

  const topGroup = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontFamily: "Inter", fontSize: 22, fontWeight: 700, letterSpacing: 4, color: accentHex, textTransform: "uppercase" }}>
        Presenter Reel
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontFamily: titleFont, fontSize: 52, fontWeight: 600, lineHeight: 1.18, color: textColor }}>
        {content.headline}
      </div>
    </div>
  );

  const middleGroup = content.bullets.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {content.bullets.map((b, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CheckIcon size={24} color={accentHex} strokeWidth={2} />
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 27, color: mutedColor }}>{b}</div>
        </div>
      ))}
    </div>
  ) : null;

  const bottomGroup = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {content.price && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          {content.price.mrp && content.price.mrp > content.price.amount && (
            <div style={{ display: "flex", fontFamily: "Inter", fontSize: 24, color: mutedColor, textDecoration: "line-through" }}>
              {formatPrice(content.price.mrp)}
            </div>
          )}
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 40, fontWeight: 700, color: accentHex }}>
            {formatPrice(content.price.amount)}
            {content.price.discountPercent ? ` (${content.price.discountPercent}% OFF)` : ""}
          </div>
        </div>
      )}
      {content.ctaText && (
        <div
          style={{
            display: "flex",
            marginTop: 32,
            backgroundColor: accentHex,
            borderRadius: 36,
            padding: "20px 0",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 28, fontWeight: 700, color: "#1a1408" }}>{content.ctaText}</div>
        </div>
      )}
    </div>
  );

  const groups = [topGroup, middleGroup, bottomGroup].filter(Boolean);

  const element = (
    <div style={{ display: "flex", flexDirection: "column", width: WIDTH, height: HEIGHT, position: "relative", backgroundColor: `${accentHex}22` }}>
      {/* Gradient runs the full frame height for a natural photographic
          fade — only the TEXT is constrained to the top 75%, so the
          reserved bottom zone doesn't read as an abrupt cutoff. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 980,
          backgroundImage: `linear-gradient(to bottom, ${contrast}00 0px, ${contrast}30 380px, ${contrast}7A 700px, ${contrast}9E 980px)`,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: CONTENT_BOTTOM,
          position: "relative",
          padding: "110px 60px 0px",
          justifyContent: "space-between",
        }}
      >
        {groups}
      </div>
    </div>
  );

  const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}
