import { Sora, Manrope } from "next/font/google";
import "./materials-theme.css";

// "Sage Studio" visual direction (chosen 2026-09-10 from the two
// prototypes built after the user's own reference-design upload — see
// docs/home-material/ui/decisions.md). Fonts are loaded here, scoped to
// this domain only, rather than in the root layout, so the fashion side
// of the app keeps its own Geist/Cormorant/Poppins typography untouched
// — matches this domain's existing "own identity, shared infra only"
// convention (CLAUDE.md's domain-separation rule, applied to visual
// design the same way it's already applied to schema/business logic).
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sora.variable} ${manrope.variable} hm-theme`}>{children}</div>;
}
