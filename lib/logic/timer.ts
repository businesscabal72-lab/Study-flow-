/**
 * Focus timer state machine. Remaining time is always derived from absolute
 * timestamps (endsAt − now), so it stays correct when the tab is
 * backgrounded, throttled, or the user navigates between pages.
 */
export type TimerMode = "focus" | "short_break" | "long_break";
export type TimerStatus = "idle" | "running" | "paused" | "finished";

export interface TimerState {
  mode: TimerMode;
  status: TimerStatus;
  durationMs: number;
  remainingMs: number; // authoritative while idle/paused
  endsAt: number | null; // authoritative while running
  startedAt: number | null; // first start of this session
  sessionId: string; // idempotency key for saving
  subjectId: string | null;
  focusCount: number; // completed focus rounds (for long-break cadence)
  saved: boolean; // whether a finished focus session was persisted
}

export function createTimer(mode: TimerMode, minutes: number, sessionId: string, subjectId: string | null = null, focusCount = 0): TimerState {
  const durationMs = Math.round(minutes * 60_000);
  return { mode, status: "idle", durationMs, remainingMs: durationMs, endsAt: null, startedAt: null, sessionId, subjectId, focusCount, saved: false };
}

export function remaining(s: TimerState, now: number): number {
  if (s.status === "running" && s.endsAt != null) return Math.max(0, s.endsAt - now);
  if (s.status === "finished") return 0;
  return s.remainingMs;
}

export function start(s: TimerState, now: number): TimerState {
  if (s.status === "running" || s.status === "finished") return s;
  return { ...s, status: "running", endsAt: now + s.remainingMs, startedAt: s.startedAt ?? now };
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.status !== "running") return s;
  return { ...s, status: "paused", remainingMs: remaining(s, now), endsAt: null };
}

/** Advance the state; flips running → finished once the end time passes. */
export function tick(s: TimerState, now: number): TimerState {
  if (s.status === "running" && s.endsAt != null && now >= s.endsAt) {
    return { ...s, status: "finished", remainingMs: 0, focusCount: s.mode === "focus" ? s.focusCount + 1 : s.focusCount };
  }
  return s;
}

export function reset(s: TimerState, newSessionId: string): TimerState {
  return { ...createTimer(s.mode, s.durationMs / 60_000, newSessionId, s.subjectId, s.focusCount) };
}

/** Next mode after finishing: every 4th focus round earns a long break. */
export function nextMode(s: TimerState): TimerMode {
  if (s.mode !== "focus") return "focus";
  return s.focusCount > 0 && s.focusCount % 4 === 0 ? "long_break" : "short_break";
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
