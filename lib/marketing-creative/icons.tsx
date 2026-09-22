/**
 * Plain-function icon components used by the feature-row/trust-badge
 * regions in renderer.tsx.
 *
 * NOT lucide-react's exported components directly — those are wrapped in
 * `React.forwardRef`, which satori's tree walker (a from-scratch element
 * interpreter, not a real React render pass — see renderer.tsx's header)
 * cannot invoke correctly: live-tested (2026-09-22) and confirmed it throws
 * "Cannot read properties of null (reading 'useContext')", the classic
 * signature of a hook-like call happening outside React's render dispatch.
 * Satori's own docs say it supports "pure and stateless" custom
 * components — a forwardRef object isn't a plain function component, so it
 * doesn't qualify even though a normal function component does.
 *
 * These are plain functions rendering the exact same <svg> shape lucide's
 * own components produce, using the identical path data lucide-react ships
 * (ISC-licensed, node_modules/lucide-react/dist/esm/icons/*.mjs) — same
 * icon, same license, just without the forwardRef wrapper satori can't
 * walk. If this repo's icon set grows meaningfully, revisit converting
 * icons to inline SVG at build time instead of hand-copying paths.
 */
import type { ReactElement } from "react";
import type { IconKey } from "./types";

export interface IconProps {
  size: number;
  color: string;
  strokeWidth?: number;
}

function svgIcon(paths: Array<{ tag: "path" | "circle"; attrs: Record<string, string> }>) {
  return function Icon({ size, color, strokeWidth = 2 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((p, i) =>
          p.tag === "path" ? <path key={i} d={p.attrs.d} /> : <circle key={i} cx={p.attrs.cx} cy={p.attrs.cy} r={p.attrs.r} />
        )}
      </svg>
    );
  };
}

const Sparkles = svgIcon([
  {
    tag: "path",
    attrs: {
      d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
    },
  },
  { tag: "path", attrs: { d: "M20 2v4" } },
  { tag: "path", attrs: { d: "M22 4h-4" } },
  { tag: "circle", attrs: { cx: "4", cy: "20", r: "2" } },
]);

const Feather = svgIcon([
  {
    tag: "path",
    attrs: { d: "M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z" },
  },
  { tag: "path", attrs: { d: "M16 8 2 22" } },
  { tag: "path", attrs: { d: "M17.5 15H9" } },
]);

const CheckCircle = svgIcon([
  { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
  { tag: "path", attrs: { d: "m9 12 2 2 4-4" } },
]);

const Award = svgIcon([
  {
    tag: "path",
    attrs: {
      d: "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",
    },
  },
  { tag: "circle", attrs: { cx: "12", cy: "8", r: "6" } },
]);

const Wind = svgIcon([
  { tag: "path", attrs: { d: "M12.8 19.6A2 2 0 1 0 14 16H2" } },
  { tag: "path", attrs: { d: "M17.5 8a2.5 2.5 0 1 1 2 4H2" } },
  { tag: "path", attrs: { d: "M9.8 4.4A2 2 0 1 1 11 8H2" } },
]);

const Droplet = svgIcon([
  {
    tag: "path",
    attrs: { d: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" },
  },
]);

// Used for the promo-benefits CTA's direction cue — a literal "→" (U+2192)
// tofu'd (live-tested 2026-09-22) in the same way the ₹ glyph did, since
// @fontsource/inter's bundled latin/latin-ext subsets don't cover it either.
// Same fix class: draw it, don't rely on the font.
const ArrowRight = svgIcon([
  { tag: "path", attrs: { d: "M5 12h14" } },
  { tag: "path", attrs: { d: "m12 5 7 7-7 7" } },
]);

export const ICONS: Record<IconKey, (props: IconProps) => ReactElement> = {
  sparkles: Sparkles,
  feather: Feather,
  "check-circle": CheckCircle,
  award: Award,
  wind: Wind,
  droplet: Droplet,
  "arrow-right": ArrowRight,
};
