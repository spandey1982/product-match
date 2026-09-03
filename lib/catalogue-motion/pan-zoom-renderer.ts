/**
 * Deterministic FFmpeg pan/zoom ("Ken Burns") renderer for detail/texture
 * shots — zero AI cost, zero hallucination risk, since it only ever crops
 * and scales the real source pixels; nothing is regenerated. Driven by the
 * same preset vocabulary (grammar.ts's CameraMovementType) and the same
 * MotionConstraints Veo uses, so "elegant" vs "dynamic" intensity actually
 * changes the motion here too, not just Veo's prompt text.
 *
 * Every zoompan expression below is a closed-form function of `on` (the
 * output frame counter), computed once here and inlined as literal numbers —
 * deliberately NOT the common `zoom+delta` accumulator-style recipe most
 * "ffmpeg Ken Burns" examples use, whose meaning has drifted across ffmpeg
 * versions and is a known source of "sudden jump" bugs. `-frames:v` is the
 * authoritative exact-duration mechanism, not `-t` (which is just a loose
 * safety cap on the looped input) — see MOTION_CLIP_WIDTH/HEIGHT/FPS in
 * render-spec.ts for why the output shape must match Veo's exactly:
 * compose.ts's concat filter does zero normalization between clips.
 */
import { randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runFfmpeg, probeVideo } from "./ffmpeg";
import { MOTION_CLIP_WIDTH, MOTION_CLIP_HEIGHT, MOTION_CLIP_FPS } from "./render-spec";
import type { MotionPreset, MotionConstraints } from "./types";

// 3x upscale before cropping in — real pixel detail for tight zooms like
// macro-push, without the wasted compute of upscaling far past what's ever
// visible in the output frame.
const UPSCALE_W = MOTION_CLIP_WIDTH * 3;
const UPSCALE_H = MOTION_CLIP_HEIGHT * 3;

// cinematic-drift and perspective-shift's own grammar.ts description text
// explicitly calls for motion subtler than their same-type siblings
// (horizontal-slide, diagonal-slide) at identical intensity — without this,
// they'd move identically, contradicting their own stated grammar.
const DRIFT_FACTOR = 0.4;

export interface PanZoomRenderInput {
  sourceImageUrl: string;
  preset: MotionPreset;
  constraints: MotionConstraints;
  durationSec: number;
}

export interface PanZoomRenderResult {
  videoBuffer: Buffer;
  durationMs: number;
  width: number;
  height: number;
}

function esc(n: number): string {
  return n.toFixed(6);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Linear 0→1 progress as a function of the output frame index, for a given exact frame count N. */
function progressExpr(N: number): string {
  return `on/max(${N}-1\\,1)`;
}

/** Smoothstep-eased 0→1 progress — used only for slight-orbit's "settle" feel. */
function easedExpr(N: number): string {
  const p = progressExpr(N);
  return `(3*pow(${p}\\,2)-2*pow(${p}\\,3))`;
}

const CENTER_X = "(iw-iw/zoom)/2";
const CENTER_Y = "(ih-ih/zoom)/2";

interface FilterParams {
  z: string;
  x: string;
  y: string;
}

function zoomRamp(zStart: number, zEnd: number, p: string): FilterParams {
  const z = zStart === zEnd ? esc(zStart) : `${esc(zStart)}+${esc(zEnd - zStart)}*${p}`;
  return { z, x: CENTER_X, y: CENTER_Y };
}

/** Zoom level that leaves exactly `frac` of travel room in the crop window for a pan/track/orbit move. */
function zoomForPanFrac(frac: number, constraints: MotionConstraints): number {
  return clamp(1 / (1 - Math.min(frac, 0.9)), 1 + constraints.cameraMagnitude, constraints.maxZoom);
}

function buildFilterParams(preset: MotionPreset, constraints: MotionConstraints, durationSec: number, N: number): FilterParams {
  const p = progressExpr(N);
  const targetDeltaZ = Math.min(constraints.maxZoom - 1, constraints.maxZoomSpeed * durationSec);
  // "at 1080p" (constraints.ts) read as the 1080-line reference frame, not
  // its 1920 long edge — confirmed by test render: the 1920 reading produced
  // pan motion barely distinguishable between first/last frame even at
  // "dynamic" intensity, contradicting the constraint labels' own stated
  // progression (minimal "barely perceptible" -> elegant "gentle" -> dynamic
  // "noticeable"). This reference gives that progression real visual range.
  const panFrac = (constraints.maxPanSpeed * durationSec) / 1080;

  switch (preset.id) {
    case "slow-push-in":
    case "macro-push":
      return zoomRamp(1, 1 + targetDeltaZ, p);

    case "slow-pull-out":
    case "detail-reveal":
      return zoomRamp(1 + targetDeltaZ, 1, p);

    case "tilt-up": {
      const z = zoomForPanFrac(panFrac, constraints);
      return { z: esc(z), x: CENTER_X, y: `(ih-ih/zoom)*(1-${p})` };
    }
    case "tilt-down": {
      const z = zoomForPanFrac(panFrac, constraints);
      return { z: esc(z), x: CENTER_X, y: `(ih-ih/zoom)*${p}` };
    }

    case "horizontal-slide": {
      const z = zoomForPanFrac(panFrac, constraints);
      return { z: esc(z), x: `(iw-iw/zoom)*${p}`, y: CENTER_Y };
    }
    case "diagonal-slide": {
      // Split the travel budget across both axes so total diagonal speed
      // matches a plain slide, rather than moving faster on each axis at once.
      const z = zoomForPanFrac(panFrac / Math.SQRT2, constraints);
      return { z: esc(z), x: `(iw-iw/zoom)*${p}`, y: `(ih-ih/zoom)*${p}` };
    }
    case "cinematic-drift": {
      const z = zoomForPanFrac(panFrac * DRIFT_FACTOR, constraints);
      return { z: esc(z), x: `(iw-iw/zoom)*${p}`, y: CENTER_Y };
    }

    case "perspective-shift": {
      // Its own grammar text says "no rotation" — this is just a damped pan+zoom, not a compromise.
      const z = zoomForPanFrac((panFrac / Math.SQRT2) * DRIFT_FACTOR, constraints);
      return { z: esc(z), x: `(iw-iw/zoom)*${p}`, y: `(ih-ih/zoom)*${p}` };
    }

    case "slight-orbit": {
      // No real depth from a flat photo, so this is an honest approximation,
      // not faked parallax: an eased zoom-in ties together with an eased
      // sway toward one side, both bounded by the same orbit budget — a
      // fake layered foreground/background parallax was considered and
      // rejected (product photos have no clean fg/bg separation without
      // segmentation; a botched ghosting artifact would be a worse failure
      // than the Veo warping this renderer exists to avoid).
      const orbitFrac = panFrac * (constraints.maxOrbitDeg / 8); // 8 = grammar.ts's own "3–8° arc" ceiling for this preset
      const zOrbit = zoomForPanFrac(orbitFrac, constraints);
      const eased = easedExpr(N);
      return {
        z: `1+${esc(zOrbit - 1)}*${eased}`,
        x: `${eased}*(iw-iw/zoom)*0.5`,
        y: CENTER_Y,
      };
    }

    case "breathing-hold":
      return zoomRamp(1, 1 + constraints.ambientMotion * 0.01, p);

    default:
      // Graceful degradation for any preset not explicitly handled — matches
      // this pipeline's convention elsewhere (resolveShotSources, sanitizePlan).
      return zoomRamp(1, 1 + targetDeltaZ, p);
  }
}

function buildVf(params: FilterParams): string {
  return (
    `scale=${UPSCALE_W}:${UPSCALE_H}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${UPSCALE_W}:${UPSCALE_H},` +
    `zoompan=z='${params.z}':x='${params.x}':y='${params.y}':d=1:s=${MOTION_CLIP_WIDTH}x${MOTION_CLIP_HEIGHT}:fps=${MOTION_CLIP_FPS},` +
    // zoompan's internal scale-factor rounding can leave SAR very slightly
    // off 1:1 (e.g. 26560:26559) and, worse, DIFFERENT between separate
    // renders depending on each preset's zoom math — harmless on its own,
    // but compose.ts's concat filter rejects inputs whose SAR doesn't match
    // exactly. Force square pixels explicitly rather than relying on it
    // happening to come out that way (confirmed live: it doesn't, reliably).
    `setsar=1`
  );
}

export async function renderPanZoomClip(input: PanZoomRenderInput): Promise<PanZoomRenderResult> {
  const N = Math.max(1, Math.round(input.durationSec * MOTION_CLIP_FPS));
  const params = buildFilterParams(input.preset, input.constraints, input.durationSec, N);
  const vf = buildVf(params);

  const srcPath = join(tmpdir(), `motion-panzoom-src-${randomUUID()}.jpg`);
  const outPath = join(tmpdir(), `motion-panzoom-out-${randomUUID()}.mp4`);

  try {
    const res = await fetch(input.sourceImageUrl);
    if (!res.ok) throw new Error(`Failed to fetch source image (HTTP ${res.status})`);
    await writeFile(srcPath, Buffer.from(await res.arrayBuffer()));

    const t0 = Date.now();
    await runFfmpeg([
      "-y",
      "-loop", "1",
      "-framerate", String(MOTION_CLIP_FPS),
      "-i", srcPath,
      "-t", String(input.durationSec + 1),
      "-vf", vf,
      "-frames:v", String(N),
      "-r", String(MOTION_CLIP_FPS),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ]);
    const durationMs = Date.now() - t0;

    // Fail fast inside the render attempt (hits the existing render-worker
    // retry path) rather than letting a mismatched clip silently reach QA/
    // compose, where it would break concat with no diagnostic.
    const probe = await probeVideo(outPath);
    const expectedDurationSec = N / MOTION_CLIP_FPS;
    if (
      probe.width !== MOTION_CLIP_WIDTH ||
      probe.height !== MOTION_CLIP_HEIGHT ||
      Math.abs(probe.durationSec - expectedDurationSec) > 0.5
    ) {
      throw new Error(
        `Pan-zoom render mismatch: got ${probe.width}x${probe.height}/${probe.durationSec}s, ` +
          `expected ${MOTION_CLIP_WIDTH}x${MOTION_CLIP_HEIGHT}/${expectedDurationSec}s`
      );
    }

    const videoBuffer = await readFile(outPath);
    return { videoBuffer, durationMs, width: probe.width, height: probe.height };
  } finally {
    await unlink(srcPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
