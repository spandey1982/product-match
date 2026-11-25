"use client";

import { useState } from "react";
import {
  applyPalette,
  deletePalette,
  renamePalette,
  savePalette,
  type SavedPalette,
} from "@/lib/mentis-coming-soon/colour-store";
import { COLOUR_PARAMETERS, type ColourConfig } from "@/lib/mentis-coming-soon/theme";
import styles from "./customizer.module.css";

function sameColours(a: ColourConfig, b: ColourConfig): boolean {
  return COLOUR_PARAMETERS.every((p) => a[p.key] === b[p.key]);
}

export function SavedPaletteManager({ palettes, current }: { palettes: SavedPalette[]; current: ColourConfig }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function save() {
    savePalette(name);
    setName("");
  }

  return (
    <div>
      <div className={styles.row}>
        <input
          type="text"
          className={styles.input}
          placeholder="Name (e.g. Warm Creative)"
          value={name}
          maxLength={40}
          aria-label="Palette name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>
          Save combination
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        {palettes.length === 0 && <p className={styles.hint}>No saved combinations yet.</p>}
        {palettes.map((p) => {
          const active = sameColours(p.colours, current);
          return (
            <div key={p.id} className={styles.palette}>
              <button type="button" className={styles.strip} title="Apply this combination" aria-label={`Apply palette ${p.name}`} onClick={() => applyPalette(p.id)}>
                {COLOUR_PARAMETERS.map((param) => (
                  <i key={param.key} style={{ background: p.colours[param.key] }} />
                ))}
              </button>
              {editingId === p.id ? (
                <input
                  type="text"
                  className={styles.input}
                  value={editName}
                  maxLength={40}
                  autoFocus
                  aria-label="New palette name"
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renamePalette(p.id, editName);
                      setEditingId(null);
                    } else if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => {
                    renamePalette(p.id, editName);
                    setEditingId(null);
                  }}
                />
              ) : (
                <button type="button" className={`${styles.paletteName} ${active ? styles.paletteActive : ""}`} onClick={() => applyPalette(p.id)}>
                  {active ? "● " : ""}
                  {p.name}
                </button>
              )}
              <button
                type="button"
                className={`${styles.btn} ${styles.small}`}
                onClick={() => {
                  setEditingId(p.id);
                  setEditName(p.name);
                }}
              >
                Rename
              </button>
              <button type="button" className={`${styles.btn} ${styles.small} ${styles.btnDanger}`} onClick={() => deletePalette(p.id)} aria-label={`Delete palette ${p.name}`}>
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
