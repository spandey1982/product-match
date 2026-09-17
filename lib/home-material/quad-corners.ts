export interface Point {
  x: number;
  y: number;
}

/**
 * Robustly orders 4 arbitrary points as [TL, TR, BR, BL] regardless of
 * the order they were produced in — a user's manual click sequence has
 * no guaranteed winding direction or starting corner, unlike AI wall
 * detection's own output (wall-detection.ts's prompt explicitly asks for
 * TL/TR/BR/BL order). The "sum/diff" trick, standard for ordering the
 * corners of a roughly-upright quadrilateral (not rotated ~45°+ — this
 * domain's own guided capture, "stand facing the wall," already assumes
 * this elsewhere): the top-left corner has the smallest x+y, the
 * bottom-right the largest x+y; the top-right corner has the smallest
 * y-x, the bottom-left the largest y-x.
 */
export function orderQuadCorners(points: Point[]): Point[] {
  const sums = points.map((p) => p.x + p.y);
  const diffs = points.map((p) => p.y - p.x);
  const tl = points[sums.indexOf(Math.min(...sums))];
  const br = points[sums.indexOf(Math.max(...sums))];
  const tr = points[diffs.indexOf(Math.min(...diffs))];
  const bl = points[diffs.indexOf(Math.max(...diffs))];
  return [tl, tr, br, bl];
}

const ANGLED_THRESHOLD = 0.015; // fraction of the quad's own diagonal

/**
 * True when an (already TL/TR/BR/BL-ordered) quad deviates meaningfully
 * from its own axis-aligned bounding box — i.e. it's a real trapezoid,
 * not just a rectangle with normal hand-click imprecision. Below this
 * threshold, lib/home-material/visualization.ts's perspective-warp path
 * would produce a visually identical result to the cheaper, crisper flat
 * tiling path anyway (a rectangle-to-rectangle homography is just a
 * scale+translate) while costing a per-pixel resampling pass — not worth
 * it for a wall that isn't actually angled.
 */
export function isMeaningfullyAngled(orderedQuad: Point[]): boolean {
  const xs = orderedQuad.map((p) => p.x);
  const ys = orderedQuad.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (diag === 0) return false;

  const bboxCorners: Point[] = [
    { x: minX, y: minY }, // TL
    { x: maxX, y: minY }, // TR
    { x: maxX, y: maxY }, // BR
    { x: minX, y: maxY }, // BL
  ];
  const maxDeviation = Math.max(...orderedQuad.map((p, i) => Math.hypot(p.x - bboxCorners[i].x, p.y - bboxCorners[i].y)));
  return maxDeviation / diag > ANGLED_THRESHOLD;
}

/**
 * A manually-traced (or manually re-shaped) 4-point wall outline is
 * effectively a perspective quad — the user traced the wall's real
 * corners by hand, at least as trustworthy as an AI guess. Previously
 * only an AI-supplied `corners` field (sub-problem B) could ever unlock
 * lib/home-material/visualization.ts's perspective-aware rendering, even
 * though a hand-traced 4-point shape IS a quad (2026-09-17 fix). Returns
 * null for anything that isn't a genuinely angled 4-point trace — a
 * differently-sized outline (routed around an obstruction, or a
 * non-rectangular room shape) or a plain straight-on rectangle both fall
 * back to the existing non-perspective paths unchanged.
 */
export function deriveQuadFromTrace(points: Point[]): Point[] | null {
  if (points.length !== 4) return null;
  const ordered = orderQuadCorners(points);
  return isMeaningfullyAngled(ordered) ? ordered : null;
}
