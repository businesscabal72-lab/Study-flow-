"use client";
import { format, isSameDay } from "date-fns";
import { Check } from "lucide-react";
import { colorFor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import type { StudySession, Subject } from "@/types/database";

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_PX = 52;

/** Day/week time grid with absolutely positioned study sessions. */
export function TimeGrid({
  days,
  sessions,
  subjects,
  allDay,
  onSlotClick,
  onSessionClick,
  onToggleComplete,
}: {
  days: Date[];
  sessions: StudySession[];
  subjects: Map<string, Subject>;
  allDay: (day: Date) => React.ReactNode;
  onSlotClick: (at: Date) => void;
  onSessionClick: (s: StudySession) => void;
  onToggleComplete: (s: StudySession) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const now = new Date();
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length > 1 ? 720 : undefined }}>
          {/* Header + all-day row */}
          <div className="grid border-b border-border bg-surface" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d.toISOString()} className="border-l border-border px-2 py-2">
                <p className={cn("text-[11px] font-medium uppercase text-muted-foreground", isSameDay(d, now) && "text-primary")}>{format(d, "EEE")}</p>
                <p className={cn("text-lg font-semibold tabular-nums leading-tight", isSameDay(d, now) && "text-primary")}>{format(d, "d")}</p>
                <div className="mt-1 space-y-0.5">{allDay(d)}</div>
              </div>
            ))}
          </div>
          {/* Hours */}
          <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0,1fr))` }}>
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="relative pr-2 text-right text-[10px] text-muted-foreground">
                  <span className="relative -top-1.5">{h === START_HOUR ? "" : format(new Date(2000, 0, 1, h), "h a")}</span>
                </div>
              ))}
            </div>
            {days.map((d) => {
              const daySessions = sessions.filter((s) => isSameDay(new Date(s.start_time), d));
              return (
                <div key={d.toISOString()} className="relative border-l border-border">
                  {hours.map((h) => (
                    <button
                      key={h}
                      style={{ height: HOUR_PX }}
                      className="block w-full border-b border-border/60 hover:bg-accent/40"
                      aria-label={`Add session ${format(d, "EEE MMM d")} at ${format(new Date(2000, 0, 1, h), "h a")}`}
                      onClick={() => {
                        const at = new Date(d);
                        at.setHours(h, 0, 0, 0);
                        onSlotClick(at);
                      }}
                    />
                  ))}
                  {isSameDay(d, now) && now.getHours() >= START_HOUR && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-destructive" style={{ top: ((now.getHours() - START_HOUR) * 60 + now.getMinutes()) * (HOUR_PX / 60) }}>
                      <span className="absolute -left-1 -top-1 size-2 rounded-full bg-destructive" />
                    </div>
                  )}
                  {daySessions.map((s) => {
                    const st = new Date(s.start_time);
                    const en = new Date(s.end_time);
                    const startMin = Math.max(0, (st.getHours() - START_HOUR) * 60 + st.getMinutes());
                    const endMin = Math.min((END_HOUR - START_HOUR) * 60, (en.getHours() - START_HOUR) * 60 + en.getMinutes() + (isSameDay(st, en) ? 0 : 24 * 60));
                    const height = Math.max(22, (endMin - startMin) * (HOUR_PX / 60) - 2);
                    const subj = s.subject_id ? subjects.get(s.subject_id) : null;
                    const c = colorFor(subj?.color);
                    const done = s.status === "completed";
                    return (
                      <div
                        key={s.id}
                        className={cn("absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-soft", c.soft, done && "opacity-60", s.status === "skipped" && "opacity-40")}
                        style={{ top: startMin * (HOUR_PX / 60) + 1, height, borderLeftColor: c.hex }}
                      >
                        <button className="block w-full text-left" onClick={() => onSessionClick(s)}>
                          <p className={cn("truncate text-[11px] font-medium leading-tight", done && "line-through")}>{s.title}</p>
                          {height > 34 && <p className="truncate text-[10px] text-muted-foreground">{format(st, "h:mm")}–{format(en, "h:mm a")}</p>}
                        </button>
                        <button
                          onClick={() => onToggleComplete(s)}
                          aria-label={done ? `Mark ${s.title} not done` : `Mark ${s.title} complete`}
                          className={cn("absolute right-1 top-1 grid size-4 place-items-center rounded border", done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 bg-background/70")}
                        >
                          {done && <Check className="size-3" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
