import { Product } from "@/types";

// ─── Try-On ───────────────────────────────────────────────────────────────────

/**
 * Sentinel productCategory for a garment captured live via the camera
 * (quick-capture trial room layout) — no catalog category/color exists for
 * it. Defined here (not lib/tryon.ts) because this file is imported by
 * client components (TrialRoomProvider) and lib/tryon.ts pulls in Node-only
 * modules (fs/promises) that would break the client bundle — see
 * lib/client-modules.ts's client/server split for the same concern.
 */
export const CAPTURED_GARMENT_CATEGORY = "captured-garment";

/**
 * crypto.randomUUID() only exists in a secure context (HTTPS, or the browser
 * treating the origin as "localhost") — it's undefined on a phone hitting
 * the dev server over its plain-HTTP LAN IP, a common way to test on a real
 * device. These ids are only ever used as client-side React keys / session
 * state identifiers, never as security tokens, so a non-cryptographic
 * fallback is fine when the real thing isn't available.
 */
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  /**
   * Present only for a garment captured live via the camera (quick-capture
   * trial room layout) — a data-URL of the captured photo, persisted so a
   * page reload can still retry generation. Absent for catalog entries.
   */
  garmentDataUrl?: string;
}

// ─── Captured garments (quick-capture layout) ──────────────────────────────────

/**
 * A garment captured live via the camera has no catalog Product row — this
 * fabricates a minimal, valid Product purely so it can sit in TryOnEntry.product
 * unchanged, letting every existing consumer (TryOnCard, TryOnViewer, wishlist)
 * work without modification. Never sent to any Product API — client-side only,
 * scoped to this session.
 */
export function createCapturedGarmentProduct(sequence: number): Product {
  const now = new Date().toISOString();
  return {
    id: `captured-${generateClientId()}`,
    title: `Captured garment ${sequence}`,
    category: CAPTURED_GARMENT_CATEGORY,
    color: "",
    colors: [],
    occasion: [],
    styleTags: [],
    gender: "unisex",
    season: [],
    price: 0,
    isForRent: false,
    inStock: true,
    isActive: true,
    userId: "session",
    createdAt: now,
    updatedAt: now,
  };
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
