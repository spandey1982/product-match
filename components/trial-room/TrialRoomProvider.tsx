"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { Product } from "@/types";
import { TryOnEntry, TryOnStatus, WishlistEntry } from "@/lib/trial-room-types";

// ─── Limit ────────────────────────────────────────────────────────────────────

/** Maximum number of non-failed try-ons allowed at the same time. */
export const TRYON_LIMIT = 5;

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "trial-room-v1";

// ─── State + context shape ────────────────────────────────────────────────────

interface TrialRoomState {
  photo: File | null;
  photoPreviewUrl: string | null;
  /** Data-URL copy of the photo used for localStorage persistence. */
  photoDataUrl: string | null;
  tryOns: TryOnEntry[];
  wishlist: WishlistEntry[];
}

export interface TrialRoomContextValue extends Omit<TrialRoomState, "photoDataUrl"> {
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
  /**
   * True for ~3 s after triggerSetupHint() is called. Consumers use this
   * to visually highlight the "Set Up Trial Room" entry point.
   */
  setupHintActive: boolean;
  /** Call when the user attempts a try-on action without a photo. */
  triggerSetupHint: () => void;
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

// ─── Persistence helpers ──────────────────────────────────────────────────────

/** Convert a data-URL string back into a File object. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** Empty state — used for SSR and the first client render so the two match. */
const INITIAL_STATE: TrialRoomState = {
  photo: null,
  photoPreviewUrl: null,
  photoDataUrl: null,
  tryOns: [],
  wishlist: [],
};

/**
 * Read localStorage and reconstruct state. Must NOT be used as the initial
 * useState value: it would diverge between server (empty) and client
 * (persisted), causing a hydration mismatch. Call it from an effect after
 * mount instead.
 */
function loadPersistedState(): TrialRoomState {
  if (typeof window === "undefined") return INITIAL_STATE;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;

    const { photoDataUrl, tryOns, wishlist } = JSON.parse(raw) as {
      photoDataUrl?: string | null;
      tryOns?: TryOnEntry[];
      wishlist?: WishlistEntry[];
    };

    // Any entry that was mid-generation when the page was closed can never
    // complete now — downgrade it to "failed" so the user can retry.
    const restoredTryOns = (tryOns ?? []).map((t) =>
      t.status === "generating"
        ? {
            ...t,
            status: "failed" as TryOnStatus,
            errorMessage: "Session was interrupted. Please retry.",
          }
        : t
    );

    let photo: File | null = null;
    let photoPreviewUrl: string | null = null;

    if (photoDataUrl) {
      // Data URLs are valid img src values — no blob needed for display.
      photoPreviewUrl = photoDataUrl;
      // Reconstruct the File so addToQueue / retryTryOn can still use it.
      photo = dataUrlToFile(photoDataUrl, "customer-photo.jpg");
    }

    return {
      photo,
      photoPreviewUrl,
      photoDataUrl: photoDataUrl ?? null,
      tryOns: restoredTryOns,
      wishlist: wishlist ?? [],
    };
  } catch {
    return INITIAL_STATE;
  }
}

/** Write the serialisable slice to localStorage. Silently swallows quota errors. */
function persistState(
  photoDataUrl: string | null,
  tryOns: TryOnEntry[],
  wishlist: WishlistEntry[]
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ photoDataUrl, tryOns, wishlist })
    );
  } catch {
    // Storage quota exceeded — non-fatal
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TrialRoomProvider({ children }: { children: React.ReactNode }) {
  // Start from deterministic empty state so the server render and the first
  // client render match (avoids hydration mismatch). The persisted state is
  // loaded from localStorage after mount in the effect below.
  const [state, setState] = useState<TrialRoomState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [setupHintActive, setSetupHintActive] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate from localStorage once, after the first client render ──────────
  // localStorage is browser-only, so it cannot be read during render without
  // diverging from the server HTML. A one-time mount sync from an external
  // store is the intended use of setState-in-effect; the lint rule can't
  // distinguish it from a render-loop, so it's disabled for this line only.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage (browser-only store)
    setState(loadPersistedState());
    setHydrated(true);
  }, []);

  // Clean up hint timer on unmount
  useEffect(() => () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); }, []);

  // ── Persist state to localStorage whenever the relevant slices change ──────
  // Guarded on `hydrated` so the initial empty state can't overwrite persisted
  // data before it has been loaded.
  useEffect(() => {
    if (!hydrated) return;
    persistState(state.photoDataUrl, state.tryOns, state.wishlist);
  }, [hydrated, state.photoDataUrl, state.tryOns, state.wishlist]);

  const triggerSetupHint = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setSetupHintActive(true);
    hintTimerRef.current = setTimeout(() => setSetupHintActive(false), 3000);
  }, []);

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
    // Immediately update the preview with a fast blob URL
    setState((prev) => {
      if (prev.photoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.photoPreviewUrl);
      return {
        ...prev,
        photo: file,
        photoPreviewUrl: URL.createObjectURL(file),
        photoDataUrl: null, // populated async below
      };
    });

    // Async: convert to data URL for persistence
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) ?? null;
      setState((prev) => ({ ...prev, photoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = useCallback(() => {
    setState((prev) => {
      if (prev.photoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.photoPreviewUrl);
      return { ...prev, photo: null, photoPreviewUrl: null, photoDataUrl: null };
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

  // ── Clear all — also wipes localStorage ───────────────────────────────────

  const clearAll = useCallback(() => {
    setState((prev) => {
      if (prev.photoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.photoPreviewUrl);
      return { photo: null, photoPreviewUrl: null, photoDataUrl: null, tryOns: [], wishlist: [] };
    });
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

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
      photo: state.photo,
      photoPreviewUrl: state.photoPreviewUrl,
      tryOns: state.tryOns,
      wishlist: state.wishlist,
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
      setupHintActive,
      triggerSetupHint,
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
      setupHintActive,
      triggerSetupHint,
      isInWishlist,
    ]
  );

  return (
    <TrialRoomContext.Provider value={value}>
      {children}
    </TrialRoomContext.Provider>
  );
}
