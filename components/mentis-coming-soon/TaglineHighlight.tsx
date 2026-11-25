import type { ReactNode } from "react";
import styles from "./coming-soon.module.css";

// Hand-painted brush stroke drawn as inline SVG so its fill follows
// --mentis-tagline-background (no flattened image). Stretches with the text.
const BRUSH_PATH =
  "M6 24 C28 9 86 15 150 11 S282 6 340 12 C372 14 391 9 396 21 L391 27 L398 34 L390 42 L397 51 L388 59 " +
  "C358 71 300 66 240 70 S110 75 60 69 C36 67 14 71 8 60 L14 52 L4 45 L12 37 L3 30 Z";

export function TaglineHighlight({ children }: { children: ReactNode }) {
  return (
    <p className={styles.tagline}>
      <svg className={styles.taglineBg} viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={BRUSH_PATH} />
      </svg>
      <span className={styles.taglineText}>{children}</span>
    </p>
  );
}
