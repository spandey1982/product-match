/**
 * Sheet-count calculation for repeat-pattern sheet goods (wallpaper,
 * veneer, wood panels, and eventually tiles) — 2026-09-09, built after a
 * detailed walkthrough with the user of exactly how real installers
 * count sheets. Deliberately does NOT compare horizontal vs. vertical
 * roll orientation (the user's explicit simplification: "let's keep it
 * horizontal placement always to avoid calculation") — always treats the
 * sheet's longer dimension as running along the combined wall run's
 * width, the shorter dimension as the per-row height.
 *
 * Adjacency (which walls are physically next to each other, sharing a
 * real corner) is NEVER inferred here — it's a fact the caller supplies,
 * confirmed by the user in the UI (see HmSurface.adjacencyGroupId's doc
 * comment for why: auto-detecting adjacency from a photo is sub-problem
 * A from the multi-wall discussion, explicitly paused).
 */

export interface WallForSheetCalc {
  id: string;
  widthM: number;
  heightM: number;
  /** Walls sharing the same non-null value are one continuous run (widths summed before the ceiling formula applies once). Null = independent. */
  adjacencyGroupId: string | null;
}

export interface SheetDimensions {
  widthM: number;
  heightM: number;
}

export interface SheetCalcGroup {
  wallIds: string[];
  /** Sum of the group's wall widths (a single wall's own width when not grouped). */
  combinedWidthM: number;
  /** Max of the group's wall heights — a defensive choice: never under-orders if heights differ slightly within one continuous run. */
  heightM: number;
  sheetsNeeded: number;
}

export interface SheetCalcResult {
  totalSheets: number;
  groups: SheetCalcGroup[];
}

/**
 * Ceiling-divides a continuous run's width/height by the sheet's long/
 * short dimensions respectively — a partial sheet still consumes a whole
 * one, matching how sheets/rolls are actually bought.
 */
function sheetsForRun(combinedWidthM: number, heightM: number, sheet: SheetDimensions): number {
  const longDim = Math.max(sheet.widthM, sheet.heightM);
  const shortDim = Math.min(sheet.widthM, sheet.heightM);
  const cols = Math.ceil(combinedWidthM / longDim);
  const rows = Math.ceil(heightM / shortDim);
  return cols * rows;
}

export function calculateSheetsNeeded(walls: WallForSheetCalc[], sheet: SheetDimensions): SheetCalcResult {
  const grouped = new Map<string, WallForSheetCalc[]>();
  const independent: WallForSheetCalc[] = [];

  for (const wall of walls) {
    if (wall.adjacencyGroupId) {
      const list = grouped.get(wall.adjacencyGroupId) ?? [];
      list.push(wall);
      grouped.set(wall.adjacencyGroupId, list);
    } else {
      independent.push(wall);
    }
  }

  const groups: SheetCalcGroup[] = [];

  for (const wallsInGroup of grouped.values()) {
    const combinedWidthM = wallsInGroup.reduce((sum, w) => sum + w.widthM, 0);
    const heightM = Math.max(...wallsInGroup.map((w) => w.heightM));
    groups.push({
      wallIds: wallsInGroup.map((w) => w.id),
      combinedWidthM,
      heightM,
      sheetsNeeded: sheetsForRun(combinedWidthM, heightM, sheet),
    });
  }

  for (const wall of independent) {
    groups.push({
      wallIds: [wall.id],
      combinedWidthM: wall.widthM,
      heightM: wall.heightM,
      sheetsNeeded: sheetsForRun(wall.widthM, wall.heightM, sheet),
    });
  }

  return {
    totalSheets: groups.reduce((sum, g) => sum + g.sheetsNeeded, 0),
    groups,
  };
}
