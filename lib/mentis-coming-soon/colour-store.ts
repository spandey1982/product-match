// Browser-only persistent store for the temporary colour customiser.
// Shaped for React's useSyncExternalStore: the server snapshot is always the
// defaults, so SSR/hydration never mismatches; localStorage is read lazily on
// the client. No backend, no auth. Delete with the customiser.
import { normaliseHex } from "./colour-utils";
import { COLOUR_PARAMETERS, DEFAULT_COLOURS, type ColourConfig, type ColourKey } from "./theme";

export type SavedPalette = { id: string; name: string; colours: ColourConfig };

export type StoreState = {
  colours: ColourConfig;
  histories: Record<ColourKey, string[]>;
  palettes: SavedPalette[];
  widgetHidden: boolean;
  panelOpen: boolean;
};

const STORAGE_KEY = "mentis-colour-customizer-v1";

function defaultState(): StoreState {
  const histories = {} as Record<ColourKey, string[]>;
  for (const p of COLOUR_PARAMETERS) histories[p.key] = [DEFAULT_COLOURS[p.key]];
  return { colours: { ...DEFAULT_COLOURS }, histories, palettes: [], widgetHidden: false, panelOpen: false };
}

const SERVER_STATE = defaultState();

function sanitiseColours(raw: unknown): ColourConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as ColourConfig;
  for (const p of COLOUR_PARAMETERS) {
    const v = normaliseHex(String((raw as Record<string, unknown>)[p.key] ?? ""));
    if (!v) return null;
    out[p.key] = v;
  }
  return out;
}

function load(): StoreState {
  const base = defaultState();
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return base;
    const raw = JSON.parse(text) as Record<string, unknown>;
    const colours = sanitiseColours(raw.colours);
    if (colours) base.colours = colours;
    if (raw.histories && typeof raw.histories === "object") {
      for (const p of COLOUR_PARAMETERS) {
        const list = (raw.histories as Record<string, unknown>)[p.key];
        if (!Array.isArray(list)) continue;
        const clean = [...new Set(list.map((x) => normaliseHex(String(x))).filter((x): x is string => !!x))];
        if (clean.length) base.histories[p.key] = clean;
      }
    }
    if (Array.isArray(raw.palettes)) {
      base.palettes = raw.palettes.flatMap((x): SavedPalette[] => {
        const item = x as Record<string, unknown>;
        const c = sanitiseColours(item?.colours);
        if (!c || typeof item.id !== "string" || typeof item.name !== "string") return [];
        return [{ id: item.id, name: item.name.slice(0, 40), colours: c }];
      });
    }
    base.widgetHidden = raw.widgetHidden === true;
    base.panelOpen = raw.panelOpen === true;
  } catch {
    // Unavailable or corrupt storage: fall back to defaults.
  }
  return base;
}

let state: StoreState | null = null;
const listeners = new Set<() => void>();

export function getSnapshot(): StoreState {
  if (!state) state = load();
  return state;
}
export function getServerSnapshot(): StoreState {
  return SERVER_STATE;
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  state = load();
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function commit(next: StoreState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/blocked: keep working in memory for this session.
  }
  listeners.forEach((l) => l());
}

export type AddResult = { ok: true; duplicate: boolean } | { ok: false; error: string };

/** Apply a colour to a parameter without saving it to its list (live preview). */
export function applyColour(key: ColourKey, hex: string) {
  const v = normaliseHex(hex);
  const s = getSnapshot();
  if (!v || s.colours[key] === v) return;
  commit({ ...s, colours: { ...s.colours, [key]: v } });
}

/** Validate, apply and save a colour to that parameter's own list. */
export function addColour(key: ColourKey, raw: string): AddResult {
  const v = normaliseHex(raw);
  if (!v) return { ok: false, error: "Enter a valid HEX code, e.g. #F5E8D3 or #FA0." };
  const s = getSnapshot();
  const list = s.histories[key];
  const duplicate = list.includes(v);
  commit({
    ...s,
    colours: { ...s.colours, [key]: v },
    histories: duplicate ? s.histories : { ...s.histories, [key]: [...list, v] },
  });
  return { ok: true, duplicate };
}

export function removeSavedColour(key: ColourKey, hex: string) {
  const s = getSnapshot();
  commit({ ...s, histories: { ...s.histories, [key]: s.histories[key].filter((c) => c !== hex) } });
}

export function savePalette(name: string) {
  const s = getSnapshot();
  const finalName = name.trim().slice(0, 40) || `Palette ${String(s.palettes.length + 1).padStart(2, "0")}`;
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  commit({ ...s, palettes: [...s.palettes, { id, name: finalName, colours: { ...s.colours } }] });
}

export function applyPalette(id: string) {
  const s = getSnapshot();
  const p = s.palettes.find((x) => x.id === id);
  if (p) commit({ ...s, colours: { ...p.colours } });
}

export function renamePalette(id: string, name: string) {
  const s = getSnapshot();
  const n = name.trim().slice(0, 40);
  if (!n) return;
  commit({ ...s, palettes: s.palettes.map((p) => (p.id === id ? { ...p, name: n } : p)) });
}

export function deletePalette(id: string) {
  const s = getSnapshot();
  commit({ ...s, palettes: s.palettes.filter((p) => p.id !== id) });
}

/** Restore default colours; saved colour lists and palettes are kept. */
export function resetToDefault() {
  const s = getSnapshot();
  commit({ ...s, colours: { ...DEFAULT_COLOURS } });
}

export function setWidgetHidden(hidden: boolean) {
  const s = getSnapshot();
  if (s.widgetHidden !== hidden) commit({ ...s, widgetHidden: hidden });
}

export function setPanelOpen(open: boolean) {
  const s = getSnapshot();
  if (s.panelOpen !== open) commit({ ...s, panelOpen: open });
}
