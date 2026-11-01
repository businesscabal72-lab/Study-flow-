"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "pending" | "saving" | "error";

/**
 * Debounced autosave that merges partial patches. Pending changes are
 * flushed on unmount and the browser warns before closing with unsaved work.
 */
export function useAutosave<P extends object>(save: (patch: P) => Promise<unknown>, delay = 800) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Partial<P> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const patch = pending.current;
    if (!patch) return true;
    pending.current = null;
    setStatus("saving");
    let ok = true;
    inflight.current = (async () => {
      try {
        await saveRef.current(patch as P);
        setError(null);
        setStatus(pending.current ? "pending" : "saved");
      } catch (e) {
        ok = false;
        // keep the failed patch so the next attempt includes it
        pending.current = { ...patch, ...(pending.current ?? {}) };
        setError(e instanceof Error ? e.message : "Couldn't save");
        setStatus("error");
      }
    })();
    await inflight.current;
    inflight.current = null;
    return ok;
  }, []);

  const queue = useCallback(
    (patch: Partial<P>) => {
      pending.current = { ...(pending.current ?? {}), ...patch };
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush]
  );

  /** Drop pending changes (e.g. the record is being deleted). */
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    setStatus("saved");
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush(); // save anything left when switching notes/pages
    };
  }, [flush]);

  return { status, error, queue, flush, cancel };
}
