/**
 * Per-browser recent/most-used garment-type tracking for the New Design
 * form's quick-pick chips. Deliberately localStorage-only, not persisted
 * server-side — a UX nicety, not business data; resets per browser/device.
 */

const STORAGE_KEY = "fashion-designer-garment-usage-v1";

interface UsageEntry {
  count: number;
  lastUsedAt: number;
}

type UsageMap = Record<string, UsageEntry>;

function readUsage(): UsageMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UsageMap) : {};
  } catch {
    return {};
  }
}

/** Top garment types by usage count, most count first, then most recently used. */
export function getRecentGarmentTypes(limit = 5): string[] {
  const usage = readUsage();
  return Object.entries(usage)
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit)
    .map(([garmentType]) => garmentType);
}

/** Call after a design is successfully submitted with the chosen garmentType. */
export function recordGarmentTypeUsage(garmentType: string): void {
  if (typeof window === "undefined") return;
  try {
    const usage = readUsage();
    const existing = usage[garmentType];
    usage[garmentType] = { count: (existing?.count ?? 0) + 1, lastUsedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Best-effort — localStorage can throw (quota, privacy mode); never block submission on it.
  }
}
