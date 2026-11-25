import type { CSSProperties } from "react";
import {
  MENTIS_LOGO_ALT,
  MENTIS_LOGO_FOLLOWS_GENERAL_TEXT,
  MENTIS_LOGO_SRC,
} from "@/lib/mentis-coming-soon/config";
import { TaglineHighlight } from "./TaglineHighlight";
import styles from "./coming-soon.module.css";

// Group A: logo, subtitle, tagline. The logo file is never altered. When
// MENTIS_LOGO_FOLLOWS_GENERAL_TEXT is on, an invisible <img> supplies size and
// alt text while a CSS mask paints the logo's shape in the General Text colour.
function MentisLogo() {
  if (!MENTIS_LOGO_FOLLOWS_GENERAL_TEXT) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={MENTIS_LOGO_SRC} alt={MENTIS_LOGO_ALT} className={styles.logo} />;
  }
  return (
    <span className={styles.logoTinted} style={{ "--mentis-logo-url": `url("${MENTIS_LOGO_SRC}")` } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MENTIS_LOGO_SRC} alt={MENTIS_LOGO_ALT} className={styles.logoSizer} />
      <span className={styles.logoMask} aria-hidden="true" />
    </span>
  );
}

export function MentisBrandHeader() {
  return (
    <header className={styles.brand}>
      <MentisLogo />
      <p className={styles.subtitle}>On-Demand STEM Mentor At-Home</p>
      <TaglineHighlight>Learning, Delivered in 30 minutes</TaglineHighlight>
    </header>
  );
}
