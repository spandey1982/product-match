"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerationStatus {
  generating: boolean;
  error: string | null;
}

interface CompletionData {
  modelImageUrl: string | null;
  generatedImages: { url: string; view: string; objective?: string }[];
}

type CompletionListener = (data: CompletionData | null, error: string | null) => void;

type StatusSetter = (productId: string, status: GenerationStatus) => void;
type StatusRemover = (productId: string) => void;

interface GenerationStatusContextValue {
  startTracking: (productId: string) => void;
  stopTracking: (productId: string) => void;
  getStatus: (productId: string) => GenerationStatus | undefined;
  subscribe: (productId: string, listener: CompletionListener) => void;
  unsubscribe: (productId: string, listener: CompletionListener) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const GenerationStatusContext = createContext<GenerationStatusContextValue | null>(null);

export function useGenerationStatus() {
  const ctx = useContext(GenerationStatusContext);
  if (!ctx) throw new Error("useGenerationStatus must be used within GenerationStatusProvider");
  return ctx;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL = 3_000;
const MAX_ATTEMPTS = 100;

// ─── Polling engine (ref-based, lives outside render) ────────────────────────

interface PollRefs {
  active: React.RefObject<Set<string>>;
  attempts: React.RefObject<Map<string, number>>;
  timers: React.RefObject<Map<string, ReturnType<typeof setTimeout>>>;
  listeners: React.RefObject<Map<string, Set<CompletionListener>>>;
  setStatus: React.RefObject<StatusSetter>;
  removeStatus: React.RefObject<StatusRemover>;
}

function notifyListeners(
  refs: PollRefs,
  productId: string,
  data: CompletionData | null,
  error: string | null,
) {
  const listeners = refs.listeners.current.get(productId);
  if (listeners) {
    listeners.forEach((fn) => fn(data, error));
  }
}

function markDone(refs: PollRefs, productId: string, error: string | null) {
  refs.active.current.delete(productId);
  refs.attempts.current.delete(productId);
  const timer = refs.timers.current.get(productId);
  if (timer) clearTimeout(timer);
  refs.timers.current.delete(productId);
  refs.setStatus.current(productId, { generating: false, error });
}

function schedulePoll(refs: PollRefs, productId: string) {
  refs.timers.current.set(
    productId,
    setTimeout(() => runPoll(refs, productId), POLL_INTERVAL),
  );
}

function runPoll(refs: PollRefs, productId: string) {
  if (!refs.active.current.has(productId)) return;

  const attempt = (refs.attempts.current.get(productId) ?? 0) + 1;
  refs.attempts.current.set(productId, attempt);

  fetch(`/api/products/${productId}/model-status`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: {
      modelImageUrl: string | null;
      generatedImages: { url: string; view: string; objective?: string }[];
      failed?: boolean;
      failureMessage?: string | null;
    } | null) => {
      if (!refs.active.current.has(productId)) return;

      if (data) {
        const hasOnModel =
          data.generatedImages?.some((g) => g.objective === "model" || g.view === "on-model") ||
          !!data.modelImageUrl;

        if (hasOnModel) {
          markDone(refs, productId, null);
          notifyListeners(refs, productId, {
            modelImageUrl: data.modelImageUrl,
            generatedImages: data.generatedImages ?? [],
          }, null);
          return;
        }

        if (data.failed) {
          const msg = data.failureMessage ?? "Image generation didn't complete. Please try again in a few minutes.";
          markDone(refs, productId, msg);
          notifyListeners(refs, productId, null, msg);
          return;
        }
      }

      if (attempt >= MAX_ATTEMPTS) {
        const msg = "Image generation didn't complete. Please retry from the ⋯ menu.";
        markDone(refs, productId, msg);
        notifyListeners(refs, productId, null, msg);
        return;
      }

      schedulePoll(refs, productId);
    })
    .catch(() => {
      if (!refs.active.current.has(productId)) return;
      if ((refs.attempts.current.get(productId) ?? 0) >= MAX_ATTEMPTS) {
        const msg = "Image generation didn't complete. Please retry from the ⋯ menu.";
        markDone(refs, productId, msg);
        notifyListeners(refs, productId, null, msg);
        return;
      }
      schedulePoll(refs, productId);
    });
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function GenerationStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<Map<string, GenerationStatus>>(new Map());

  const setStatusRef = useRef<StatusSetter>((productId, status) => {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(productId, status);
      return next;
    });
  });

  const removeStatusRef = useRef<StatusRemover>((productId) => {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  });

  const listenersRef = useRef(new Map<string, Set<CompletionListener>>());
  const attemptsRef = useRef(new Map<string, number>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeRef = useRef(new Set<string>());

  const refs: PollRefs = {
    active: activeRef,
    attempts: attemptsRef,
    timers: timersRef,
    listeners: listenersRef,
    setStatus: setStatusRef,
    removeStatus: removeStatusRef,
  };

  const refsRef = useRef(refs);

  const startTracking = useCallback((productId: string) => {
    const r = refsRef.current;
    if (r.active.current.has(productId)) return;
    r.active.current.add(productId);
    r.attempts.current.set(productId, 0);
    r.setStatus.current(productId, { generating: true, error: null });
    schedulePoll(r, productId);
  }, []);

  const stopTracking = useCallback((productId: string) => {
    const r = refsRef.current;
    if (!r.active.current.has(productId)) return;
    r.active.current.delete(productId);
    r.attempts.current.delete(productId);
    const timer = r.timers.current.get(productId);
    if (timer) clearTimeout(timer);
    r.timers.current.delete(productId);
    r.removeStatus.current(productId);
  }, []);

  const getStatus = useCallback((productId: string): GenerationStatus | undefined => {
    return statusMap.get(productId);
  }, [statusMap]);

  const subscribe = useCallback((productId: string, listener: CompletionListener) => {
    if (!listenersRef.current.has(productId)) {
      listenersRef.current.set(productId, new Set());
    }
    listenersRef.current.get(productId)!.add(listener);
  }, []);

  const unsubscribe = useCallback((productId: string, listener: CompletionListener) => {
    listenersRef.current.get(productId)?.delete(listener);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <GenerationStatusContext.Provider
      value={{ startTracking, stopTracking, getStatus, subscribe, unsubscribe }}
    >
      {children}
    </GenerationStatusContext.Provider>
  );
}
