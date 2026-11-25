"use client";

// TEMPORARY brand-design tool for the Mentis Coming Soon page. Independent of
// the page components: it only writes the --mentis-* CSS variables onto the
// element marked data-mentis-theme-root, and keeps its state in localStorage.
// Remove: set ENABLE_MENTIS_COLOUR_CUSTOMIZER=false, or delete this folder,
// lib/mentis-coming-soon/colour-{store,utils}.ts and the import in ComingSoonPage.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  addColour,
  applyColour,
  getServerSnapshot,
  getSnapshot,
  removeSavedColour,
  resetToDefault,
  setPanelOpen,
  setWidgetHidden,
  subscribe,
} from "@/lib/mentis-coming-soon/colour-store";
import { contrastRatio, paletteAsCss, paletteAsJson, paletteAsText } from "@/lib/mentis-coming-soon/colour-utils";
import { COLOUR_PARAMETERS } from "@/lib/mentis-coming-soon/theme";
import { ColourParameterControl } from "./ColourParameterControl";
import { SavedPaletteManager } from "./SavedPaletteManager";
import styles from "./customizer.module.css";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ColourCustomizer() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [notice, setNotice] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colours } = state;

  // Push the selected colours into the page's CSS variables.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-mentis-theme-root]");
    if (!root) return;
    for (const p of COLOUR_PARAMETERS) root.style.setProperty(p.cssVar, colours[p.key]);
  }, [colours]);

  // Leave the page on its defaults if the widget is ever unmounted.
  useEffect(() => {
    return () => {
      const root = document.querySelector<HTMLElement>("[data-mentis-theme-root]");
      if (root) for (const p of COLOUR_PARAMETERS) root.style.removeProperty(p.cssVar);
    };
  }, []);

  // Recover a hidden widget: Ctrl+Alt+M toggles it; ?customizer=show restores it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("customizer") === "show") setWidgetHidden(false);
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.altKey && e.code === "KeyM") {
        e.preventDefault();
        setWidgetHidden(!getSnapshot().widgetHidden);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function flash(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  }

  async function copy(label: string, text: string) {
    flash((await copyText(text)) ? `${label} copied` : "Copy failed: select the text manually");
  }

  if (state.widgetHidden) return null;

  const contrastRows = [
    { label: "General text / background", fg: colours.generalText, bg: colours.primaryBackground, min: 4.5 },
    { label: "Coming Soon / background", fg: colours.comingSoonText, bg: colours.primaryBackground, min: 3 },
    { label: "Animated words / background", fg: colours.wordEmphasis, bg: colours.primaryBackground, min: 3 },
    { label: "Tagline text / highlight", fg: colours.taglineText, bg: colours.taglineBackground, min: 4.5 },
  ].map((r) => ({ ...r, ratio: contrastRatio(r.fg, r.bg) }));

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setPanelOpen(!state.panelOpen)} aria-label={state.panelOpen ? "Close colour panel" : "Open colour panel"} aria-expanded={state.panelOpen} title="Colour experiments">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3Z" />
          <circle cx="7.5" cy="11" r="1" fill="currentColor" />
          <circle cx="10.5" cy="7" r="1" fill="currentColor" />
          <circle cx="15" cy="7.5" r="1" fill="currentColor" />
        </svg>
      </button>

      {state.panelOpen && (
        <div className={styles.panel} role="dialog" aria-label="Mentis colour experiments">
          <div className={styles.head}>
            <span className={styles.title}>Colour experiments</span>
            <span className={styles.row}>
              <button type="button" className={styles.btn} onClick={() => setWidgetHidden(true)} title="Hide the widget completely. Restore with Ctrl+Alt+M or ?customizer=show">
                Hide widget
              </button>
              <button type="button" className={styles.btn} onClick={() => setPanelOpen(false)} aria-label="Close panel">
                ✕
              </button>
            </span>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Colours</h3>
            {COLOUR_PARAMETERS.map((p) => (
              <ColourParameterControl
                key={p.key}
                parameter={p}
                current={colours[p.key]}
                saved={state.histories[p.key]}
                onPreview={(hex) => applyColour(p.key, hex)}
                onAdd={(raw) => addColour(p.key, raw)}
                onSelect={(hex) => applyColour(p.key, hex)}
                onRemove={(hex) => removeSavedColour(p.key, hex)}
              />
            ))}
            <div className={styles.row}>
              <button type="button" className={styles.btn} onClick={resetToDefault}>
                Reset to default
              </button>
              <button type="button" className={styles.btn} onClick={() => copy("Palette", paletteAsText(colours))}>
                Copy palette
              </button>
              <button type="button" className={styles.btn} onClick={() => setShowExport((v) => !v)} aria-expanded={showExport}>
                {showExport ? "Hide export" : "Export"}
              </button>
            </div>
            {showExport && (
              <div style={{ marginTop: 8 }}>
                <div className={styles.row}>
                  <strong>JSON</strong>
                  <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => copy("JSON", paletteAsJson(colours))}>
                    Copy
                  </button>
                </div>
                <textarea className={styles.exportBox} readOnly value={paletteAsJson(colours)} aria-label="Palette JSON" />
                <div className={styles.row} style={{ marginTop: 8 }}>
                  <strong>CSS custom properties</strong>
                  <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => copy("CSS", paletteAsCss(colours))}>
                    Copy
                  </button>
                </div>
                <textarea className={styles.exportBox} readOnly value={paletteAsCss(colours)} aria-label="Palette CSS" />
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Saved combinations</h3>
            <SavedPaletteManager palettes={state.palettes} current={colours} />
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Contrast (guidance only)</h3>
            <ul className={styles.contrast}>
              {contrastRows.map((r) => (
                <li key={r.label} className={r.ratio >= r.min ? styles.ok : styles.warn}>
                  <span>{r.label}</span>
                  <span>
                    {r.ratio.toFixed(1)}:1 {r.ratio >= r.min ? "✓" : "⚠ low"}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>Targets: 4.5 for body-size text, 3.0 for large text. Nothing is blocked.</p>
            <p className={styles.hint}>Hidden the widget? Press Ctrl+Alt+M or add ?customizer=show to the URL.</p>
          </div>

          {notice && (
            <div className={styles.notice} role="status">
              {notice}
            </div>
          )}
        </div>
      )}
    </>
  );
}
