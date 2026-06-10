/**
 * Lightweight image metadata helpers — header parsing only, no full decode.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Extract pixel dimensions from a raw image buffer by reading file headers.
 * Returns null for unsupported formats (WebP) or truncated buffers.
 */
export function getImageDimensions(
  buf: Buffer,
  mime: string
): ImageDimensions | null {
  try {
    if (mime === "image/png") {
      // PNG IHDR chunk: bytes 16-19 = width, 20-23 = height (big-endian uint32)
      if (buf.length < 24) return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    if (mime === "image/jpeg") {
      // Walk JPEG segments looking for SOF markers
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);
        if (isSOF) {
          // [FF marker][2B length][1B precision][2B height][2B width]
          return {
            height: buf.readUInt16BE(i + 5),
            width: buf.readUInt16BE(i + 7),
          };
        }
        const segLen = buf.readUInt16BE(i + 2);
        i += 2 + segLen;
      }
      return null;
    }

    // WebP header parsing is non-trivial; omit for now
    return null;
  } catch {
    return null;
  }
}

/** Format a byte count as a human-readable string. */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}
