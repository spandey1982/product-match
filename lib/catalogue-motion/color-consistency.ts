/**
 * Cross-shot color/tone consistency — algorithmic, no LLM cost, same
 * "cheap check first" philosophy as workers/qa.ts's Stage 1. Front and back
 * source photos for a job come from independent generations with no shared
 * color anchor (see research/reel-engine-components.html, Component 7) —
 * this has never been verified, only flagged as a plausible risk. Advisory
 * only: this never blocks or fails a compose, it only records a note for a
 * human to see, since the flag threshold below is a first-pass heuristic
 * with no calibration data yet from real accepted/rejected outcomes.
 */
import { averageFrameColor, type AverageColor } from "./ffmpeg";

export interface ClipColorSample {
  view: string;
  color: AverageColor;
}

export interface ColorConsistencyResult {
  flagged: boolean;
  maxDelta: number;
  note: string | null;
}

/**
 * Euclidean RGB distance out of a theoretical max of ~441 (sqrt(255^2*3)).
 * Picked as "clearly different to the eye, not a rounding artifact" without
 * real calibration data — treat as a first-pass heuristic, not a validated
 * threshold, until enough real jobs have run to check it against actual
 * human judgment.
 */
const FLAG_THRESHOLD = 45;

function colorDistance(a: AverageColor, b: AverageColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function fmt(c: AverageColor): string {
  return `${c.r},${c.g},${c.b}`;
}

/** Samples one representative frame per ordered clip, at a point within its planned on-screen duration (never past it, even if the underlying render is longer). */
export async function sampleClipColors(
  clips: Array<{ view: string; outputUrl: string; plannedHoldSec: number }>
): Promise<ClipColorSample[]> {
  const samples = await Promise.allSettled(
    clips.map(async (c) => {
      const atSec = Math.max(0.1, Math.min(c.plannedHoldSec / 2, c.plannedHoldSec - 0.1));
      const color = await averageFrameColor(c.outputUrl, atSec);
      return { view: c.view, color };
    })
  );
  // Best-effort: a single clip's sampling failure (e.g. a transient fetch
  // error) shouldn't take down the whole consistency check — just compares
  // whichever clips succeeded.
  return samples
    .filter((s): s is PromiseFulfilledResult<ClipColorSample> => s.status === "fulfilled")
    .map((s) => s.value);
}

/** Pairwise-compares every sampled clip and flags the worst mismatch, if any exceeds FLAG_THRESHOLD. */
export function checkColorConsistency(samples: ClipColorSample[]): ColorConsistencyResult {
  let maxDelta = 0;
  let worstPair: [ClipColorSample, ClipColorSample] | null = null;

  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const d = colorDistance(samples[i].color, samples[j].color);
      if (d > maxDelta) {
        maxDelta = d;
        worstPair = [samples[i], samples[j]];
      }
    }
  }

  const flagged = maxDelta > FLAG_THRESHOLD && worstPair !== null;
  const note = flagged && worstPair
    ? `${worstPair[0].view} (avg rgb ${fmt(worstPair[0].color)}) vs ${worstPair[1].view} (avg rgb ${fmt(worstPair[1].color)}): ` +
      `color delta ${maxDelta.toFixed(0)} — possible tone drift between independently generated source photos`
    : null;

  return { flagged, maxDelta, note };
}
