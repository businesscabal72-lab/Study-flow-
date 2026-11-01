"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as T from "@/lib/logic/timer";
import { recordFocusSession } from "@/lib/data/practice";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/format";
import { useProfile } from "./use-data";
import { useSession } from "./use-session";

const STORAGE_KEY = "studyflow.timer.v1";

interface Durations {
  focus: number;
  short_break: number;
  long_break: number;
}

interface FocusTimerCtx {
  state: T.TimerState;
  remainingMs: number;
  durations: Durations;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setMode: (mode: T.TimerMode, minutes?: number) => void;
  setSubject: (id: string | null) => void;
  setFocusMinutes: (min: number) => void;
  saving: boolean;
}

const Ctx = createContext<FocusTimerCtx | null>(null);
const newId = () => crypto.randomUUID();

function load(key: string): T.TimerState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T.TimerState) : null;
  } catch {
    return null;
  }
}

function persist(key: string, s: T.TimerState) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* storage may be unavailable (private mode) — timer still works in memory */
  }
}

/**
 * App-wide focus timer. Lives in the authenticated layout so it keeps running
 * across page navigation; state is persisted to localStorage with absolute
 * timestamps so reloads, background tabs and throttled intervals stay accurate.
 */
export function FocusTimerProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile();
  const { userId } = useSession();
  const storageKey = `${STORAGE_KEY}.${userId}`; // per-user, safe on shared devices
  const qc = useQueryClient();
  const durations: Durations = {
    focus: profile?.focus_minutes ?? 25,
    short_break: profile?.short_break_minutes ?? 5,
    long_break: profile?.long_break_minutes ?? 15,
  };
  const [state, setState] = useState<T.TimerState>(() => T.createTimer("focus", 25, "pending"));
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(false);
  const savingRef = useRef(false);

  // Hydrate from storage once on the client.
  useEffect(() => {
    const stored = load(storageKey);
    setState(stored ? T.tick(stored, Date.now()) : T.createTimer("focus", durations.focus, newId()));
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the profile's default duration once, if the timer is untouched.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (!profile || appliedDefault.current) return;
    appliedDefault.current = true;
    setState((s) =>
      s.status === "idle" && s.startedAt == null && s.mode === "focus" && s.durationMs !== profile.focus_minutes * 60_000
        ? T.createTimer("focus", profile.focus_minutes, s.sessionId, s.subjectId, s.focusCount)
        : s
    );
  }, [profile]);

  useEffect(() => {
    // Skip the pre-hydration placeholder so it never overwrites stored state.
    if (hydrated.current && state.sessionId !== "pending") persist(storageKey, state);
  }, [state, storageKey]);

  // Ticking only drives re-renders; time itself comes from timestamps.
  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((s) => T.tick(s, t));
    }, 500);
    const onVisible = () => {
      const t = Date.now();
      setNow(t);
      setState((s) => T.tick(s, t));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.status]);

  // Sync between tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          setState(T.tick(JSON.parse(e.newValue) as T.TimerState, Date.now()));
        } catch {
          /* ignore malformed */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  // Persist finished focus sessions exactly once (client_id makes it idempotent).
  useEffect(() => {
    if (state.status !== "finished" || state.saved || savingRef.current) return;
    if (state.mode !== "focus") {
      setState((s) => ({ ...s, saved: true }));
      notify("Break's over", "Ready for another focus session?", profile?.notification_prefs.focus_complete ?? true);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    // The real finish time is the scheduled end, even if the tab was closed when it passed.
    const completedAt = new Date(Math.min(Date.now(), state.endsAt ?? Date.now()));
    const started = new Date(state.startedAt ?? completedAt.getTime() - state.durationMs);
    recordFocusSession(getSupabaseBrowser(), {
      client_id: state.sessionId,
      subject_id: state.subjectId,
      duration_minutes: Math.max(1, Math.round(state.durationMs / 60_000)),
      started_at: started.toISOString(),
      completed_at: (completedAt > started ? completedAt : new Date(started.getTime() + 60_000)).toISOString(),
    })
      .then(() => {
        setState((s) => (s.sessionId === state.sessionId ? { ...s, saved: true } : s));
        qc.invalidateQueries({ queryKey: qk.focus });
        notify("Focus session complete", "Nice work — time for a break.", profile?.notification_prefs.focus_complete ?? true);
        toast.success("Focus session saved");
      })
      .catch((e) => toast.error(`Couldn't save the session: ${errorMessage(e)}. It will retry when you reopen this page.`))
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  }, [state, profile, qc]);

  const start = useCallback(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
    setState((s) => T.start(s, Date.now()));
  }, []);
  const pause = useCallback(() => setState((s) => T.pause(s, Date.now())), []);
  const reset = useCallback(() => setState((s) => T.reset(s, newId())), []);
  const setMode = useCallback(
    (mode: T.TimerMode, minutes?: number) =>
      setState((s) => T.createTimer(mode, minutes ?? durations[mode], newId(), s.subjectId, s.focusCount)),
    [durations]
  );
  const setSubject = useCallback((id: string | null) => setState((s) => ({ ...s, subjectId: id })), []);
  const setFocusMinutes = useCallback(
    (min: number) =>
      setState((s) => (s.status === "idle" ? T.createTimer(s.mode, Math.min(180, Math.max(1, min)), s.sessionId, s.subjectId, s.focusCount) : s)),
    []
  );

  return (
    <Ctx.Provider
      value={{ state, remainingMs: T.remaining(state, now), durations, start, pause, reset, setMode, setSubject, setFocusMinutes, saving }}
    >
      {children}
    </Ctx.Provider>
  );
}

function notify(title: string, body: string, enabled: boolean) {
  if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    // Android Chrome requires showNotification via the service worker
    navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, icon: "/icons/icon-192.png" })).catch(() => undefined);
  }
}

export function useFocusTimer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFocusTimer must be used within FocusTimerProvider");
  return ctx;
}
