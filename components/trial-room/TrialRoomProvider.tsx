"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Product } from "@/types";
import { TryOnEntry, TryOnStatus, WishlistEntry } from "@/lib/trial-room-types";

// ─── Limit ────────────────────────────────────────────────────────────────────

/** Maximum number of non-failed try-ons allowed at the same time. */
export const TRYON_LIMIT = 5;

// ─── State + context shape ────────────────────────────────────────────────────

interface TrialRoomState {
  photo: File | null;
  photoPreviewUrl: string | null;
  tryOns: TryOnEntry[];
  wishlist: WishlistEntry[];
}

export interface TrialRoomContextValue extends TrialRoomState {
  /** Set the active user photo. Creates a blob preview URL. */
  setPhoto: (file: File) => void;
  /** Clear the active user photo and its preview URL. */
  clearPhoto: () => void;
  /**
   * Add a product to the try-on queue and immediately begin background
   * generation. No-op if the product is already queued or generating.
   */
  addToQueue: (product: Product) => void;
  /** Retry a failed try-on entry. */
  retryTryOn: (tryOnId: string) => void;
  /** Remove a try-on entry (and any linked wishlist entry). */
  removeFromTryOns: (tryOnId: string) => void;
  /** Promote a completed try-on to the wishlist. */
  addToWishlist: (tryOnId: string) => void;
  /** Remove a wishlist entry. */
  removeFromWishlist: (wishlistId: string) => void;
  /** Reset the entire trial room state. */
  clearAll: () => void;
  /**
   * Returns the TryOnEntry for the given product if one exists in the queue.
   * Returns undefined when no entry exists (or all entries failed).
   */
  findActiveTryOn: (productId: string) => TryOnEntry | undefined;
  /**
   * Returns the most recent TryOnEntry for the given product regardless of
   * status — including failed entries. Useful for showing retry affordance.
   */
  findAnyTryOn: (productId: string) => TryOnEntry | undefined;
  /** Number of non-failed try-ons currently in the session. */
  activeTryOnCount: number;
  /** True when activeTryOnCount has reached TRYON_LIMIT. */
  isAtLimit: boolean;
  /**
   * True once the first product has been added to the try-on queue.
   * When locked, the customer photo cannot be replaced to prevent
   * inconsistencies with already-generated results.
   */
  isPhotoLocked: boolean;
  /** True if the product has a non-failed entry in the queue. */
  isInWishlist: (tryOnId: string) => boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TrialRoomContext = createContext<TrialRoomContextValue | null>(null);

export function useTrialRoom(): TrialRoomContextValue {
  const ctx = useContext(TrialRoomContext);
  if (!ctx) throw new Error("useTrialRoom must be used within TrialRoomProvider");
  return ctx;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: TrialRoomState = {
  photo: null,
  photoPreviewUrl: null,
  tryOns: [],
  wishlist: [],
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TrialRoomProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TrialRoomState>(INITIAL_STATE);

  // Refs ensure async generation callbacks always read the latest values even
  // when captured in a stale closure. Synced in useLayoutEffect so the update
  // happens after render, never during it (satisfies react-hooks/refs).
  const photoRef = useRef<File | null>(null);
  const stateRef = useRef<TrialRoomState>(state);

  useLayoutEffect(() => {
    photoRef.current = state.photo;
    stateRef.current = state;
  });

  // ── Photo ──────────────────────────────────────────────────────────────────

  const setPhoto = useCallback((file: File) => {
    setState((prev) => {
      if (prev.photoPreviewUrl) URL.revokeObjectURL(prev.photoPreviewUrl);
      return {
        ...prev,
        photo: file,
        photoPreviewUrl: URL.createObjectURL(file),
      };
    });
  }, []);

  const clearPhoto = useCallback(() => {
    setState((prev) => {
      if (prev.photoPreviewUrl) URL.revokeObjectURL(prev.photoPreviewUrl);
      return { ...prev, photo: null, photoPreviewUrl: null };
    });
  }, []);

  // ── Generation engine ──────────────────────────────────────────────────────

  // Runs a try-on API call in the background and updates the entry in context
  // when it settles — regardless of which page the user is currently on.
  function runGeneration(entryId: string, productId: string, photo: File) {
    const formData = new FormData();
    formData.append("photo", photo);

    fetch(`/api/products/${productId}/tryon`, { method: "POST", body: formData })
      .then((res) => res.json())
      .then((data: { tryOnUrl?: string; error?: string }) => {
        if (data.tryOnUrl) {
          setState((prev) => ({
            ...prev,
            tryOns: prev.tryOns.map((t) =>
              t.id === entryId
                ? { ...t, status: "done" as TryOnStatus, resultUrl: data.tryOnUrl }
                : t
            ),
          }));
        } else {
          setState((prev) => ({
            ...prev,
            tryOns: prev.tryOns.map((t) =>
              t.id === entryId
                ? {
                    ...t,
                    status: "failed" as TryOnStatus,
                    errorMessage: data.error ?? "Generation failed. Please retry.",
                  }
                : t
            ),
          }));
        }
      })
      .catch(() => {
        setState((prev) => ({
          ...prev,
          tryOns: prev.tryOns.map((t) =>
            t.id === entryId
              ? {
                  ...t,
                  status: "failed" as TryOnStatus,
                  errorMessage: "Network error. Please retry.",
                }
              : t
          ),
        }));
      });
  }

  // ── Try-on queue ───────────────────────────────────────────────────────────

  const addToQueue = useCallback((product: Product) => {
    const photo = photoRef.current;
    if (!photo) return;

    // Idempotency: skip if already generating or done for this product
    const current = stateRef.current.tryOns;
    const existing = current.find(
      (t) => t.productId === product.id && t.status !== "failed"
    );
    if (existing) return;

    // Enforce the active-try-on limit (failed entries don't count)
    const activeCount = current.filter((t) => t.status !== "failed").length;
    if (activeCount >= TRYON_LIMIT) return;

    const entry: TryOnEntry = {
      id: crypto.randomUUID(),
      productId: product.id,
      product,
      status: "generating",
      createdAt: Date.now(),
    };

    setState((prev) => ({ ...prev, tryOns: [entry, ...prev.tryOns] }));
    runGeneration(entry.id, product.id, photo);
  }, []);

  const retryTryOn = useCallback((tryOnId: string) => {
    const photo = photoRef.current;
    if (!photo) return;

    const entry = stateRef.current.tryOns.find((t) => t.id === tryOnId);
    if (!entry || entry.status !== "failed") return;

    setState((prev) => ({
      ...prev,
      tryOns: prev.tryOns.map((t) =>
        t.id === tryOnId
          ? { ...t, status: "generating" as TryOnStatus, errorMessage: undefined }
          : t
      ),
    }));

    runGeneration(tryOnId, entry.productId, photo);
  }, []);

  const removeFromTryOns = useCallback((tryOnId: string) => {
    setState((prev) => ({
      ...prev,
      tryOns: prev.tryOns.filter((t) => t.id !== tryOnId),
      // Cascade: remove any wishlist entry that references this try-on
      wishlist: prev.wishlist.filter((w) => w.tryOnId !== tryOnId),
    }));
  }, []);

  // ── Wishlist ───────────────────────────────────────────────────────────────

  const addToWishlist = useCallback((tryOnId: string) => {
    setState((prev) => {
      const tryOn = prev.tryOns.find(
        (t) => t.id === tryOnId && t.status === "done"
      );
      if (!tryOn?.resultUrl) return prev;
      if (prev.wishlist.some((w) => w.tryOnId === tryOnId)) return prev;

      const entry: WishlistEntry = {
        id: crypto.randomUUID(),
        tryOnId,
        product: tryOn.product,
        resultUrl: tryOn.resultUrl,
        createdAt: Date.now(),
      };

      return { ...prev, wishlist: [entry, ...prev.wishlist] };
    });
  }, []);

  const removeFromWishlist = useCallback((wishlistId: string) => {
    setState((prev) => ({
      ...prev,
      wishlist: prev.wishlist.filter((w) => w.id !== wishlistId),
    }));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setState((prev) => {
      if (prev.photoPreviewUrl) URL.revokeObjectURL(prev.photoPreviewUrl);
      return INITIAL_STATE;
    });
  }, []);

  const findActiveTryOn = useCallback(
    (productId: string) =>
      state.tryOns.find(
        (t) => t.productId === productId && t.status !== "failed"
      ),
    [state.tryOns]
  );

  const findAnyTryOn = useCallback(
    (productId: string) =>
      state.tryOns.find((t) => t.productId === productId),
    [state.tryOns]
  );

  const activeTryOnCount = state.tryOns.filter(
    (t) => t.status !== "failed"
  ).length;

  const isAtLimit = activeTryOnCount >= TRYON_LIMIT;

  // Photo is locked as soon as the first try-on is queued.
  const isPhotoLocked = state.tryOns.length > 0;

  const isInWishlist = useCallback(
    (tryOnId: string) => state.wishlist.some((w) => w.tryOnId === tryOnId),
    [state.wishlist]
  );

  // ── Context value (memoised to avoid cascading re-renders) ─────────────────

  const value = useMemo<TrialRoomContextValue>(
    () => ({
      ...state,
      setPhoto,
      clearPhoto,
      addToQueue,
      retryTryOn,
      removeFromTryOns,
      addToWishlist,
      removeFromWishlist,
      clearAll,
      findActiveTryOn,
      findAnyTryOn,
      activeTryOnCount,
      isAtLimit,
      isPhotoLocked,
      isInWishlist,
    }),
    [
      state,
      setPhoto,
      clearPhoto,
      addToQueue,
      retryTryOn,
      removeFromTryOns,
      addToWishlist,
      removeFromWishlist,
      clearAll,
      findActiveTryOn,
      findAnyTryOn,
      activeTryOnCount,
      isAtLimit,
      isPhotoLocked,
      isInWishlist,
    ]
  );

  return (
    <TrialRoomContext.Provider value={value}>
      {children}
    </TrialRoomContext.Provider>
  );
}
