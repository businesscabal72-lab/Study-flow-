"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, addWeeks, format, isSameDay, startOfDay, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Wand2 } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/misc";
import { MonthGrid, monthRange } from "@/components/calendar/month-grid";
import { TimeGrid } from "./time-grid";
import { SessionDialog } from "./session-dialog";
import { PlanReviewDialog } from "./plan-review-dialog";
import { useAssignments, useExams, useProfile, useSessions, useSubjectMap } from "@/hooks/use-data";
import { useSetSessionStatus } from "@/hooks/use-actions";
import { suggestStudyBlocks, type Suggestion } from "@/lib/logic/scheduler";
import { availabilityFromProfile } from "@/lib/logic/availability";
import { listSessions } from "@/lib/data/planner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { colorFor } from "@/lib/utils/colors";
import { errorMessage } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import type { StudySession } from "@/types/database";

type View = "day" | "week" | "month";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleView() {
  const [view, setView] = useState<View>("week");
  // Phones default to the day view (set after mount to avoid hydration mismatch).
  useEffect(() => {
    if (window.innerWidth < 768) setView("day");
  }, []);
  const [cursor, setCursor] = useState(() => new Date());
  const [dialog, setDialog] = useState<{ session?: StudySession | null; at?: Date | null } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const { data: profile } = useProfile();
  const { map: subjects } = useSubjectMap();
  const assignments = useAssignments();
  const exams = useExams();
  const setStatus = useSetSessionStatus();

  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    if (view === "week") { const f = startOfWeek(cursor, { weekStartsOn: 1 }); return { from: f, to: addDays(f, 7) }; }
    return monthRange(cursor);
  }, [view, cursor]);
  const sessions = useSessions(range.from, range.to);

  const days = useMemo(() => {
    if (view === "day") return [startOfDay(cursor)];
    return Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  }, [view, cursor, range.from]);

  const move = (dir: 1 | -1) =>
    setCursor((c) => (view === "day" ? (dir > 0 ? addDays(c, 1) : subDays(c, 1)) : view === "week" ? (dir > 0 ? addWeeks(c, 1) : subWeeks(c, 1)) : dir > 0 ? addMonths(c, 1) : subMonths(c, 1)));

  const deadlines = (d: Date) => [
    ...(assignments.data ?? []).filter((a) => a.status !== "completed" && isSameDay(new Date(a.due_date), d)).map((a) => ({ id: a.id, label: a.title, kind: "due" as const, href: `/assignments?open=${a.id}` })),
    ...(exams.data ?? []).filter((e) => isSameDay(new Date(e.exam_date), d)).map((e) => ({ id: e.id, label: e.title, kind: "exam" as const, href: `/exams?exam=${e.id}` })),
  ];

  const allDay = (d: Date) =>
    deadlines(d).map((x) => (
      <Link key={x.id} href={x.href} className={cn("block truncate rounded px-1 py-0.5 text-[10px] font-medium", x.kind === "exam" ? "bg-lavender-soft text-lavender" : "bg-sand-soft text-sand")}>
        {x.kind === "exam" ? "Exam: " : "Due: "}{x.label}
      </Link>
    ));

  const toggle = (s: StudySession) => setStatus.mutate({ id: s.id, status: s.status === "completed" ? "planned" : "completed" });

  async function openSuggestions() {
    setSuggesting(true);
    try {
      const now = new Date();
      // Busy = everything already planned in the next 7 days (fresh from the database).
      const existing = await listSessions(getSupabaseBrowser(), now, addDays(now, 7));
      const targets = [
        ...(assignments.data ?? []).filter((a) => a.status !== "completed").map((a) => ({ id: a.id, kind: "assignment" as const, title: a.title, subjectId: a.subject_id, due: new Date(a.due_date), priority: a.priority })),
        ...(exams.data ?? []).map((e) => ({ id: e.id, kind: "exam" as const, title: e.title, subjectId: e.subject_id, due: new Date(e.exam_date) })),
      ].filter((t) => t.due > now && +t.due - +now < 21 * 86_400_000);
      setSuggestions(
        suggestStudyBlocks({
          now,
          availability: availabilityFromProfile(profile),
          busy: existing.filter((s) => s.status !== "skipped").map((s) => ({ start: new Date(s.start_time), end: new Date(s.end_time) })),
          targets,
        })
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSuggesting(false);
    }
  }

  const title = view === "day" ? format(cursor, "EEEE, MMMM d") : view === "week" ? `${format(range.from, "MMM d")} – ${format(addDays(range.from, 6), "MMM d, yyyy")}` : format(cursor, "MMMM yyyy");
  const avail = availabilityFromProfile(profile);

  return (
    <div>
      <PageHeader
        title="My Schedule"
        description="Plan study sessions around your deadlines."
        actions={
          <>
            <Button variant="outline" onClick={openSuggestions} loading={suggesting}><Wand2 /> Suggest study blocks</Button>
            <Button onClick={() => setDialog({})}><Plus /> New session</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => move(1)} aria-label="Next"><ChevronRight /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <p className="ml-1 text-sm font-medium">{title}</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {sessions.error ? (
        <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : sessions.isLoading ? (
        <Skeleton className="h-[480px]" />
      ) : view === "month" ? (
        <MonthGrid
          month={cursor}
          onDayClick={(d) => { setCursor(d); setView("day"); }}
          renderDay={(d) => {
            const list = (sessions.data ?? []).filter((s) => isSameDay(new Date(s.start_time), d));
            const dl = deadlines(d);
            return (
              <>
                {dl.slice(0, 1).map((x) => <span key={x.id} className={cn("block truncate rounded px-1 text-[10px]", x.kind === "exam" ? "bg-lavender-soft text-lavender" : "bg-sand-soft text-sand")}>{x.label}</span>)}
                {list.slice(0, 2).map((s) => {
                  const c = colorFor(s.subject_id ? subjects.get(s.subject_id)?.color : null);
                  return (
                    <span key={s.id} className={cn("flex items-center gap-1 truncate text-[10px] sm:text-[11px]", s.status === "completed" && "line-through opacity-60")}>
                      <span className={cn("size-1.5 shrink-0 rounded-full", c.dot)} />
                      <span className="truncate">{format(new Date(s.start_time), "H:mm")} {s.title}</span>
                    </span>
                  );
                })}
                {list.length + dl.length > 3 && <span className="block text-[10px] text-muted-foreground">+{list.length + dl.length - 3}</span>}
              </>
            );
          }}
        />
      ) : (
        <TimeGrid
          days={days}
          sessions={sessions.data ?? []}
          subjects={subjects}
          allDay={allDay}
          onSlotClick={(at) => setDialog({ at })}
          onSessionClick={(s) => setDialog({ session: s })}
          onToggleComplete={toggle}
        />
      )}
      {!sessions.isLoading && (sessions.data ?? []).length === 0 && view !== "month" && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CalendarDays className="size-4" /> No sessions in this range. Tap a time slot to add one, or use “Suggest study blocks”.
        </p>
      )}

      <SessionDialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} session={dialog?.session} defaultDate={dialog?.at} defaultMinutes={profile?.session_minutes} />
      <PlanReviewDialog
        open={!!suggestions}
        onOpenChange={(v) => !v && setSuggestions(null)}
        title="Suggested study blocks"
        description="Based on your upcoming deadlines, exams and availability. Edit or untick anything before adding it."
        suggestions={suggestions ?? []}
        emptyMessage="No suggestions right now — either nothing is due in the next 3 weeks or your free time in the next 7 days is already booked."
        footerNote={
          <p className="text-xs text-muted-foreground">
            Availability: {avail.studyDays.map((d) => DAY_NAMES[d]).join(", ") || "no days"} · {avail.windowStart.slice(0, 5)}–{avail.windowEnd.slice(0, 5)} · {avail.sessionMinutes}-min blocks.{" "}
            <Link href="/settings?tab=preferences" className="text-primary hover:underline">Change</Link>
          </p>
        }
      />
    </div>
  );
}
