import styles from "./headline.module.css";

// "Coming Soon" on one line with a neon glow; "m" and the second "o" of "Soon"
// flicker like a faulty tube. The h1 carries the real text for assistive tech.
const SEGMENTS: { text: string; flicker?: "flickA" | "flickB" }[] = [
  { text: "Co" },
  { text: "m", flicker: "flickA" },
  { text: "ing S" },
  { text: "o", flicker: "flickB" },
  { text: "on" },
];

export function ComingSoonHeadline() {
  return (
    <h1 className={styles.neon} aria-label="Coming Soon">
      <span aria-hidden="true">
        {SEGMENTS.map((s, i) => (
          <span key={i} className={s.flicker ? styles[s.flicker] : undefined}>
            {s.text}
          </span>
        ))}
      </span>
    </h1>
  );
}
