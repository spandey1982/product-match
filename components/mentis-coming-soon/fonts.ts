import { Bricolage_Grotesque, Figtree } from "next/font/google";

export const displayFont = Bricolage_Grotesque({ variable: "--ms-display", subsets: ["latin"] });
export const bodyFont = Figtree({ variable: "--ms-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
