import type { CSSProperties } from "react";
import { ENABLE_MENTIS_COLOUR_CUSTOMIZER } from "@/lib/mentis-coming-soon/config";
import { DEFAULT_COLOURS, themeCssVariables } from "@/lib/mentis-coming-soon/theme";
import { ColourCustomizer } from "./colour-customizer/ColourCustomizer";
import { AnimatedWordCycle } from "./AnimatedWordCycle";
import { ComingSoonHeadline } from "./ComingSoonHeadline";
import { bodyFont, displayFont } from "./fonts";
import { ContactLine } from "./ContactLine";
import { MentisBrandHeader } from "./MentisBrandHeader";
import styles from "./coming-soon.module.css";

export function ComingSoonPage() {
  return (
    // data-mentis-theme-root is the only hook the (temporary) colour customiser
    // uses; the --mentis-* variables are scoped to this element.
    <div
      className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}
      style={themeCssVariables(DEFAULT_COLOURS) as CSSProperties}
      data-mentis-theme-root
    >
      <MentisBrandHeader />
      <main className={styles.main}>
        <div className={styles.group}>
          <ComingSoonHeadline />
          <AnimatedWordCycle />
        </div>
      </main>
      <ContactLine />
      {ENABLE_MENTIS_COLOUR_CUSTOMIZER && <ColourCustomizer />}
    </div>
  );
}
