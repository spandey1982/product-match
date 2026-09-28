/**
 * Chooses when to freeze the video for the end-card transition
 * (hook_end_card delivery mode) — the fix for the "looks like she's
 * mid-sentence" problem diagnosed in research/
 * presenter-reel-content-strategy.html's "End card v2" section: pulling
 * the freeze-frame from a moment ~0.5s before the clip's literal last
 * frame showed the presenter already fully settled (closed mouth, resting
 * hands), confirming this was a frame-selection bug, not a generation one.
 *
 * "smart" mode (default) analyzes the rendered clip's own audio via
 * ffmpeg's silencedetect filter to find the real end of speech — adapts
 * per-generation instead of hoping a fixed margin is always enough.
 * "fixed" mode skips that analysis and just backs off a constant offset
 * from the clip's nominal end, relying on the tighter word budget
 * (duration-budget.ts's hookWordBudget with timingMode "fixed") to leave
 * enough natural margin. Never blocks the render — any analysis failure
 * degrades to the fixed offset.
 */
import { runFfmpegCapture } from "@/lib/catalogue-motion/ffmpeg";
import type { TimingMode } from "./duration-budget";

/** Buffer after detected speech end, so the freeze-frame doesn't land exactly as her mouth is still closing. */
const POST_SPEECH_BUFFER_SEC = 0.15;
/** Fixed-mode / fallback offset from the clip's nominal end. */
const FIXED_SAFETY_MARGIN_SEC = 0.6;
/** Only trust a detected silence as "she's done talking" if it starts within the final half of the clip — an early silence mid-script is a natural pause, not the end. */
const MIN_FRACTION_FOR_TRAILING_SILENCE = 0.5;
const SILENCE_NOISE_DB = "-30dB";
const SILENCE_MIN_DURATION_SEC = 0.25;

function fixedOffsetFreeze(nominalDurationSec: number): number {
  return Math.max(0.3, nominalDurationSec - FIXED_SAFETY_MARGIN_SEC);
}

async function detectTrailingSilenceStart(clipPath: string, nominalDurationSec: number): Promise<number | null> {
  const { stderr } = await runFfmpegCapture([
    "-v", "info",
    "-i", clipPath,
    "-af", `silencedetect=noise=${SILENCE_NOISE_DB}:d=${SILENCE_MIN_DURATION_SEC}`,
    "-f", "null",
    "-",
  ]);

  const starts = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)].map((m) => parseFloat(m[1]));
  if (starts.length === 0) return null;

  const last = starts[starts.length - 1];
  if (last < nominalDurationSec * MIN_FRACTION_FOR_TRAILING_SILENCE) return null;
  return last;
}

/**
 * Returns the timestamp (seconds) to freeze the video at — always within
 * roughly [0.3, nominalDurationSec - 0.05]. Never throws: any analysis
 * failure or unusable result falls back to the fixed offset.
 */
export async function selectFreezeFrameTime(clipPath: string, timingMode: TimingMode, nominalDurationSec: number): Promise<number> {
  if (timingMode === "smart") {
    try {
      const silenceStart = await detectTrailingSilenceStart(clipPath, nominalDurationSec);
      if (silenceStart != null) {
        const t = silenceStart + POST_SPEECH_BUFFER_SEC;
        if (t > 0.3 && t < nominalDurationSec - 0.05) return t;
      }
    } catch (err) {
      console.error("[presenter-reel] silence detection failed — falling back to fixed offset:", err);
    }
  }
  return fixedOffsetFreeze(nominalDurationSec);
}
