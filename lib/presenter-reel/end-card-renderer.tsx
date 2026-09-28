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

const TITLE_FONT: Record<EndCardContent["mood"], string> = {
  heritage: "Playfair Display",
  contemporary: "Fraunces",
};

function formatPrice(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}`;
}

export async function renderEndCardPng(content: EndCardContent, accentHex: string, textOnDark: boolean): Promise<Buffer> {
  const fonts = await loadPresenterReelFonts();
  const titleFont = TITLE_FONT[content.mood];
  const textColor = textOnDark ? "#ffffff" : "#161616";
  const mutedColor = textOnDark ? "#e8e4dc" : "#3a352c";
  const CheckIcon = ICONS["check-circle"];

  const element = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        justifyContent: "center",
        padding: "0 60px",
        backgroundColor: `${accentHex}33`,
      }}
    >
      <div style={{ display: "flex", fontFamily: "Inter", fontSize: 22, fontWeight: 700, letterSpacing: 4, color: accentHex, textTransform: "uppercase" }}>
        Presenter Reel
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 20, fontFamily: titleFont, fontSize: 50, fontWeight: 600, lineHeight: 1.15, color: textColor }}>
        {content.headline}
      </div>
      {content.bullets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 18 }}>
          {content.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <CheckIcon size={22} color={accentHex} strokeWidth={2} />
              <div style={{ display: "flex", fontFamily: "Inter", fontSize: 25, color: mutedColor }}>{b}</div>
            </div>
          ))}
        </div>
      )}
      {content.price && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 40 }}>
          {content.price.mrp && content.price.mrp > content.price.amount && (
            <div style={{ display: "flex", fontFamily: "Inter", fontSize: 24, color: mutedColor, textDecoration: "line-through" }}>
              {formatPrice(content.price.mrp)}
            </div>
          )}
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 38, fontWeight: 700, color: accentHex }}>
            {formatPrice(content.price.amount)}
            {content.price.discountPercent ? ` (${content.price.discountPercent}% OFF)` : ""}
          </div>
        </div>
      )}
      {content.ctaText && (
        <div
          style={{
            display: "flex",
            marginTop: 56,
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

  const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}
