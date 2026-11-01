"use client";
import { useEffect, useMemo, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Sun, Timer as TimerIcon } from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, Skeleton } from "@/components/ui/misc";
import { SubjectDot, SubjectSelect } from "@/components/common/subject";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useFocusSessions, useSubjectMap } from "@/hooks/use-data";
import { formatClock, nextMode, type TimerMode } from "@/lib/logic/timer";
import { groupMinutesBySubject, startOfDay, startOfWeek, sumMinutes } from "@/lib/logic/analytics";
import { fmtDateTime, fmtMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const MODES: { id: TimerMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "focus", label: "Focus", icon: TimerIcon },
  { id: "short_break", label: "Short break", icon: Coffee },
  { id: "long_break", label: "Long break", icon: Sun },
];
const PRESETS = [15, 25, 45, 60, 90];

export function FocusView() {
  const t = useFocusTimer();
  const { state, remainingMs } = t;
  const [custom, setCustom] = useState("");
  const focus = useFocusSessions();
  const { map: subjects } = useSubjectMap();

  const idle = state.status === "idle";
  const pct = state.durationMs ? (1 - remainingMs / state.durationMs) * 100 : 0;
  const clock = formatClock(remainingMs);

  // Show the countdown in the tab title while running.
  useEffect(() => {
    const base = "Focus Room · StudyFlow";
    document.title = state.status === "running" ? `${clock} · ${state.mode === "focus" ? "Focus" : "Break"}` : base;
    return () => { document.title = base; };
  }, [clock, state.status, state.mode]);

  const records = useMemo(() => (focus.data ?? []).map((f) => ({ at: f.completed_at, minutes: f.duration_minutes, subjectId: f.subject_id })), [focus.data]);
  const today = sumMinutes(records, startOfDay(new Date()));
  const week = sumMinutes(records, startOfWeek(new Date()));
  const bySubject = [...groupMinutesBySubject(records).entries()].sort((a, b) => b[1] - a[1]);
  const maxSubject = bySubject[0]?.[1] ?? 0;

  return (
    <div>
      <PageHeader title="Focus Room" description="One task, one timer. Completed focus sessions are saved to your progress." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="flex flex-col items-center px-5 py-8 sm:py-12">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5" role="tablist" aria-label="Timer mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={state.mode === m.id}
                disabled={state.status === "running"}
                onClick={() => t.setMode(m.id)}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50", state.mode === m.id ? "bg-background font-medium shadow-soft" : "text-muted-foreground hover:text-foreground")}
              >
                <m.icon className="size-3.5" />{m.label}
              </button>
            ))}
          </div>

          <div className="relative my-8 grid size-64 place-items-center sm:size-72">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--muted)" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="46" fill="none"
                stroke={state.mode === "focus" ? "var(--primary)" : "var(--lavender)"}
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={2 * Math.PI * 46 * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset 0.5s linear" }}
              />
            </svg>
            <div className="text-center">
              <p className="font-mono text-6xl font-light tabular-nums tracking-tight sm:text-7xl" aria-live="off">{clock}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {state.status === "finished" ? (state.mode === "focus" ? (t.saving ? "Saving session…" : state.saved ? "Session complete ✓" : "Session complete") : "Break finished") : state.status === "paused" ? "Paused" : MODES.find((m) => m.id === state.mode)?.label}
              </p>
            </div>
          </div>

          {state.status === "finished" ? (
            <div className="flex flex-wrap justify-center gap-2">
              {(() => {
                const nm = nextMode(state);
                return <Button size="lg" onClick={() => { t.setMode(nm); setTimeout(t.start, 0); }}><Play /> Start {nm === "focus" ? "focus" : nm === "long_break" ? "long break" : "short break"}</Button>;
              })()}
              <Button size="lg" variant="outline" onClick={t.reset}><RotateCcw /> Reset</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {state.status === "running" ? (
                <Button size="lg" variant="secondary" onClick={t.pause} className="w-32"><Pause /> Pause</Button>
              ) : (
                <Button size="lg" onClick={t.start} className="w-32"><Play /> {state.status === "paused" ? "Resume" : "Start"}</Button>
              )}
              <Button size="lg" variant="outline" onClick={t.reset} disabled={idle} aria-label="Reset timer"><RotateCcw /></Button>
            </div>
          )}

          <div className="mt-8 grid w-full max-w-sm gap-3">
            <div>
              <label htmlFor="focus-subject" className="mb-1.5 block text-xs text-muted-foreground">Studying</label>
              <SubjectSelect id="focus-subject" value={state.subjectId ?? ""} onChange={(e) => t.setSubject(e.target.value || null)} noneLabel="No specific subject" disabled={state.status === "running"} />
            </div>
            {state.mode === "focus" && idle && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Duration</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((m) => (
                    <button key={m} onClick={() => t.setFocusMinutes(m)} className={cn("rounded-md border px-2.5 py-1 text-[13px]", state.durationMs === m * 60_000 ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-accent")}>
                      {m}m
                    </button>
                  ))}
                  <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const n = parseInt(custom, 10); if (n >= 1 && n <= 180) { t.setFocusMinutes(n); setCustom(""); } }}>
                    <Input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Custom" aria-label="Custom minutes (1–180)" className="h-[30px] w-20 text-[13px]" maxLength={3} />
                  </form>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">The timer keeps running if you switch pages or lock your phone.</p>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            {focus.isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />) : (
              <>
                <MiniStat label="Today" value={fmtMinutes(today)} />
                <MiniStat label="This week" value={fmtMinutes(week)} />
                <MiniStat label="Sessions completed" value={String(focus.data?.length ?? 0)} />
              </>
            )}
          </div>
          <Card>
            <CardHeader><CardTitle>By subject</CardTitle></CardHeader>
            <CardContent>
              {focus.error ? <ErrorState error={focus.error} onRetry={() => focus.refetch()} /> : bySubject.length === 0 ? (
                <EmptyState compact icon={TimerIcon} title="No focus sessions yet" description="Finish your first session to see your history." />
              ) : (
                <ul className="space-y-3">
                  {bySubject.map(([sid, min]) => {
                    const s = sid ? subjects.get(sid) : null;
                    return (
                      <li key={sid ?? "none"}>
                        <div className="mb-1 flex items-center gap-2 text-[13px]">
                          <SubjectDot color={s?.color} />
                          <span className="flex-1 truncate">{s?.name ?? "No subject"}</span>
                          <span className="tabular-nums text-muted-foreground">{fmtMinutes(min)}</span>
                        </div>
                        <Progress value={(min / maxSubject) * 100} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          {(focus.data ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {focus.data!.slice(0, 6).map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-[13px]">
                      <SubjectDot color={f.subject_id ? subjects.get(f.subject_id)?.color : null} />
                      <span className="flex-1 truncate">{f.subject_id ? subjects.get(f.subject_id)?.name ?? "Subject" : "Focus"}</span>
                      <span className="text-muted-foreground">{fmtMinutes(f.duration_minutes)}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDateTime(f.completed_at)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
