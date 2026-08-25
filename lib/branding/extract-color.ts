import sharp from "sharp";

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/**
 * Deterministic, no-AI-cost accent color suggestion from an uploaded logo.
 * Uses sharp's channel-stats dominant color rather than a true k-means
 * clustering — cheap and good enough for a prefill the admin can override,
 * not a precision color-science tool.
 */
export async function extractDominantColor(buffer: Buffer): Promise<string> {
  const stats = await sharp(buffer).stats();
  const { r, g, b } = stats.dominant;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
