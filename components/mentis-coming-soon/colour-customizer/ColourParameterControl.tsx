"use client";

import { useState } from "react";
import type { AddResult } from "@/lib/mentis-coming-soon/colour-store";
import type { COLOUR_PARAMETERS } from "@/lib/mentis-coming-soon/theme";
import styles from "./customizer.module.css";

type Parameter = (typeof COLOUR_PARAMETERS)[number];

type Props = {
  parameter: Parameter;
  current: string;
  saved: string[];
  onPreview: (hex: string) => void;
  onAdd: (raw: string) => AddResult;
  onSelect: (hex: string) => void;
  onRemove: (hex: string) => void;
};

export function ColourParameterControl({ parameter, current, saved, onPreview, onAdd, onSelect, onRemove }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const value = draft ?? current;

  function submit() {
    const result = onAdd(value);
    if (!result.ok) {
      setMessage({ text: result.error, error: true });
      return;
    }
    setDraft(null);
    setMessage(result.duplicate ? { text: "Already in this list, selected it.", error: false } : { text: "Added and applied.", error: false });
  }

  return (
    <details className={styles.param} open={parameter.key === "primaryBackground"}>
      <summary>
        <span className={styles.preview} style={{ background: current }} aria-hidden="true" />
        <span className={styles.paramName}>
          {parameter.number}. {parameter.label}
        </span>
        <span className={styles.paramHex}>{current}</span>
      </summary>
      <div className={styles.paramBody}>
        <div className={styles.row}>
          <input
            type="color"
            className={styles.picker}
            value={current.toLowerCase()}
            aria-label={`${parameter.label} colour picker`}
            onChange={(e) => {
              setDraft(null);
              setMessage(null);
              onPreview(e.target.value);
            }}
          />
          <input
            type="text"
            className={styles.input}
            value={value}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            aria-label={`${parameter.label} HEX code`}
            aria-invalid={message?.error ? true : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submit}>
            Add
          </button>
        </div>
        {message && (
          <p className={`${styles.msg} ${message.error ? styles.msgError : styles.msgInfo}`} role={message.error ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        <div className={styles.swatches} role="group" aria-label={`Saved ${parameter.label} colours`}>
          {saved.map((hex) => (
            <span key={hex} className={styles.swatchWrap}>
              <button
                type="button"
                className={`${styles.swatch} ${hex === current ? styles.swatchSelected : ""}`}
                style={{ background: hex }}
                title={hex}
                aria-label={`Use ${hex}`}
                aria-pressed={hex === current}
                onClick={() => {
                  setDraft(null);
                  setMessage(null);
                  onSelect(hex);
                }}
              />
              <button type="button" className={styles.swatchRemove} title={`Remove ${hex}`} aria-label={`Remove ${hex} from saved colours`} onClick={() => onRemove(hex)}>
                ×
              </button>
            </span>
          ))}
          {saved.length === 0 && <span className={styles.hint}>No saved colours yet.</span>}
        </div>
      </div>
    </details>
  );
}
