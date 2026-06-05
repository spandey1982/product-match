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
