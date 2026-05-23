import { Product } from "@/types";

// ─── Caption builder ──────────────────────────────────────────────────────────

/** Convert any string to a clean hashtag (alphanumeric only, CamelCased). */
function toTag(str: string): string {
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Builds an Instagram-ready caption for the given product.
 * Format: title → description → key attributes → hashtags.
 */
export function buildCaption(product: Product): string {
  const parts: string[] = [];

  // Headline
  parts.push(`✨ ${product.title}`);

  // Description excerpt
  if (product.description) {
    const excerpt =
      product.description.length > 140
        ? `${product.description.slice(0, 137)}…`
        : product.description;
    parts.push(excerpt);
  }

  parts.push(""); // blank line

  // Attributes
  if (product.color) parts.push(`🎨 ${product.color}`);
  if (product.material && product.material !== "Other")
    parts.push(`✦ ${product.material}`);
  if (product.occasion.length > 0)
    parts.push(`🌸 Perfect for: ${product.occasion.slice(0, 3).join(", ")}`);
  if (product.price > 0)
    parts.push(`💰 ₹${product.price.toLocaleString("en-IN")}`);

  parts.push(""); // blank line before hashtags

  // Hashtags (deduped, clean)
  const tagSet = new Set<string>();
  const addTag = (t: string) => { const s = toTag(t); if (s) tagSet.add(`#${s}`); };

  addTag(product.category);
  addTag(`${product.color}${product.category}`);
  if (product.material && product.material !== "Other") addTag(product.material);
  product.occasion.slice(0, 3).forEach(addTag);
  product.styleTags.slice(0, 3).forEach((t) => addTag(`${t}Fashion`));
  ["IndianFashion", "EthnicWear", "IndianEthnics", "DesiStyle"].forEach(addTag);

  parts.push([...tagSet].join(" "));

  return parts.join("\n");
}

// ─── Share via Web Share API ──────────────────────────────────────────────────

export type ShareResult = "shared" | "cancelled" | "unsupported";

/**
 * Attempts to share the model image + caption via the native Web Share API.
 * Returns "shared" on success, "cancelled" if the user dismissed the sheet,
 * or "unsupported" if the device/browser doesn't support it.
 */
export async function shareModelImage(
  imageUrl: string,
  caption: string,
  title: string
): Promise<ShareResult> {
  if (typeof navigator === "undefined" || !navigator.share) return "unsupported";

  try {
    // Fetch image from the server and wrap as a shareable File
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const file = new File([blob], `${toTag(title) || "product"}-model.${ext}`, {
      type: blob.type,
    });

    // Prefer sharing with the image file attached (iOS 15+, Android Chrome)
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: caption });
      return "shared";
    }

    // Fallback: share title + caption only (no image file)
    await navigator.share({ title, text: caption });
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
    // Any other error (fetch fail, DataError, etc.) → show fallback UI
    return "unsupported";
  }
}

// ─── Fallback utilities ───────────────────────────────────────────────────────

/**
 * Downloads the image to the user's device by creating a temporary anchor.
 * Works on all modern browsers.
 */
export async function downloadImage(
  imageUrl: string,
  filename: string
): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Small delay so the browser registers the download before revoke
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Copies text to the system clipboard.
 * Throws if the Clipboard API is not available.
 */
export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    // Legacy fallback via execCommand
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return;
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Opens the Instagram app via deep link, falling back to the website
 * after 1.5 s if the app didn't launch (desktop / app not installed).
 */
export function openInstagram(): void {
  const t = setTimeout(() => {
    window.open("https://www.instagram.com", "_blank", "noopener,noreferrer");
  }, 1500);

  // On mobile, if the app exists, this navigation succeeds; the tab
  // never actually changes location so visibilitychange fires almost
  // immediately and we cancel the fallback timer.
  const cancel = () => {
    if (document.hidden) clearTimeout(t);
  };
  document.addEventListener("visibilitychange", cancel, { once: true });

  window.location.href = "instagram://";
}
