import { Product } from "@/types";

// ─── Try-On ───────────────────────────────────────────────────────────────────

export type TryOnStatus = "generating" | "done" | "failed";

export interface TryOnEntry {
  /** Client-generated UUID, stable for the session. */
  id: string;
  productId: string;
  /** Snapshot of the product at the time the try-on was queued. */
  product: Product;
  status: TryOnStatus;
  /** Cloudinary URL — present only when status === "done". */
  resultUrl?: string;
  /** Human-readable error — present only when status === "failed". */
  errorMessage?: string;
  /** Date.now() at time of queuing. */
  createdAt: number;
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export interface WishlistEntry {
  id: string;
  /** References a completed TryOnEntry. */
  tryOnId: string;
  product: Product;
  /** Reused from the completed TryOnEntry — never regenerated. */
  resultUrl: string;
  createdAt: number;
}

// ─── Look building (nested try-on) ────────────────────────────────────────────

/** One product layered onto a look, with the composite produced by adding it. */
export interface LookSessionItem {
  product: Product;
  /** Composite try-on URL after this item was layered on. */
  resultUrl: string;
}

/**
 * An in-progress look. Starts from a completed anchor try-on (the customer
 * already wearing the anchor garment); each added item is generated onto the
 * previous composite (nested try-on). Ephemeral — lives only in the session.
 */
export interface LookSession {
  id: string;
  /** The completed TryOnEntry this look was started from. */
  baseTryOnId: string;
  /** The anchor garment (already on the customer in baseImageUrl). */
  anchorProduct: Product;
  /** The anchor try-on result — the starting composite. */
  baseImageUrl: string;
  /** Layered items, in the order added. */
  items: LookSessionItem[];
  status: "idle" | "adding" | "error";
  errorMessage?: string;
  createdAt: number;
}

/** A saved complete look: all its products + one final composite image. */
export interface SavedLook {
  id: string;
  /** All products in the look — anchor first, then layered items. */
  products: Product[];
  /** Final composite image of the whole look. */
  finalImageUrl: string;
  createdAt: number;
}

/** The current composite of a look — the last layered item, or the anchor base. */
export function lookCurrentImage(session: LookSession): string {
  return session.items.length > 0
    ? session.items[session.items.length - 1].resultUrl
    : session.baseImageUrl;
}
