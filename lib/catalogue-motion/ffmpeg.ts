/**
 * Thin ffmpeg/ffprobe wrapper — shells out to the system binaries directly
 * (child_process, no new npm dependency) rather than a wrapper package like
 * fluent-ffmpeg. Both binaries are provisioned via Nix (nixpacks.toml) in
 * production and installed locally for dev; they read straight from a
 * Cloudinary URL (both are built with network-protocol support) so nothing
 * here downloads a clip to a temp file first.
 */
import { spawn } from "child_process";

const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_BIN = process.env.FFPROBE_PATH || "ffprobe";

function run(bin: string, args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    const stdoutChunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => stdoutChunks.push(d));
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(stdoutChunks), stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasVideoStream: boolean;
}

/** Reads container/stream metadata without downloading the file. */
export async function probeVideo(url: string): Promise<ProbeResult> {
  const { stdout } = await run(FFPROBE_BIN, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    url,
  ]);
  const data = JSON.parse(stdout.toString("utf8")) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  };
  const videoStream = (data.streams ?? []).find((s) => s.codec_type === "video");
  return {
    durationSec: parseFloat(data.format?.duration ?? "0") || 0,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    hasVideoStream: Boolean(videoStream),
  };
}

/** Extracts one frame at `atSec` as a JPEG buffer, straight from the URL. */
export async function extractFrame(url: string, atSec: number): Promise<Buffer> {
  const { stdout } = await run(FFMPEG_BIN, [
    "-v", "error",
    "-ss", String(Math.max(0, atSec)),
    "-i", url,
    "-frames:v", "1",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-",
  ]);
  return stdout;
}

/** Start/middle/end frames — cheap stand-in for full video understanding, reused by QA Stage 2 and (later) the compose worker's own sanity checks. */
export async function extractSampleFrames(url: string, durationSec: number): Promise<Buffer[]> {
  const times = [0.1, Math.max(0.1, durationSec / 2), Math.max(0.2, durationSec - 0.2)];
  return Promise.all(times.map((t) => extractFrame(url, t)));
}
