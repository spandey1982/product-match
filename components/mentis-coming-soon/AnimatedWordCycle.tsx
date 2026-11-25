import styles from "./coming-soon.module.css";

// "We" is static; only the reel of words moves (pure CSS, see
// coming-soon.module.css). The reel repeats the first word at the end so the
// loop reset is invisible. The longest word is rendered once, invisibly, to
// reserve the width (no full stop: it looked off after shorter words). Under prefers-reduced-motion the animated block is hidden
// and the static three-line version is shown instead.
const WORDS = ["Engage", "Entertain", "Educate"] as const;
const REEL = [...WORDS, WORDS[0]];
const LONGEST = WORDS.reduce((a, b) => (b.length > a.length ? b : a));

export function AnimatedWordCycle() {
  return (
    <p className={styles.statement}>
      <span className={styles.animated} aria-hidden="true">
        <span>We</span>
        <span className={styles.window}>
          <span className={styles.sizer}>{LONGEST}</span>
          <span className={styles.reel}>
            {REEL.map((w, i) => (
              <span key={i} className={styles.word}>
                {w}
              </span>
            ))}
          </span>
        </span>
      </span>
      <span className={styles.static}>
        {WORDS.map((w) => (
          <span key={w} className={styles.staticLine}>
            We <span className={styles.emphasis}>{w}</span>
          </span>
        ))}
      </span>
    </p>
  );
}
