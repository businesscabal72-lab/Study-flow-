"use client";
import { useMemo, useState } from "react";
import { addWeeks, format } from "date-fns";
import { BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flame, Layers, CalendarCheck } from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress, Skeleton } from "@/components/ui/misc";
import { SubjectDot } from "@/components/common/subject";
import { ConsistencyLine, DonutChart, MinutesBarChart, StackedBarChart } from "./charts";
import { useAssignments, useFocusSessions, useReviews, useSessions, useSubjects } from "@/hooks/use-data";
import {
  chapterProgress,
  consistencyByWeek,
  currentStreak,
  groupMinutesBySubject,
  sessionMinutes,
  startOfWeek,
  sumMinutes,
  weeklyBuckets,
  type MinutesRecord,
} from "@/lib/logic/analytics";
import { colorFor } from "@/lib/utils/colors";
import { fmtMinutes, isOverdue } from "@/lib/utils/format";

const WEEKS = 8;

export function ProgressView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const rangeStart = useMemo(() => addWeeks(startOfWeek(new Date()), -(WEEKS - 1)), []);
  const rangeEnd = useMemo(() => addWeeks(startOfWeek(new Date()), 1), []);

  const focus = useFocusSessions();
  const sessions = useSessions(rangeStart, rangeEnd);
  const assignments = useAssignments();
  const reviews = useReviews(rangeStart);
  const subjects = useSubjects();

  const loading = focus.isLoading || sessions.isLoading || assignments.isLoading || reviews.isLoading || subjects.isLoading;
  const error = focus.error || sessions.error || assignments.error || reviews.error || subjects.error;

  const data = useMemo(() => {
    if (loading || error) return null;
    const completedSessions = (sessions.data ?? []).filter((s) => s.status === "completed");
    const study: MinutesRecord[] = [
      ...(focus.data ?? []).map((f) => ({ at: f.completed_at, minutes: f.duration_minutes, subjectId: f.subject_id })),
      ...completedSessions.map((s) => ({ at: s.start_time, minutes: sessionMinutes(s.start_time, s.end_time), subjectId: s.subject_id })),
    ];
    const totalFocusMin = sumMinutes((focus.data ?? []).map((f) => ({ at: f.completed_at, minutes: f.duration_minutes })));
    const allA = assignments.data ?? [];
    const activityDates = [...study.map((r) => r.at), ...(reviews.data ?? []).map((r) => r.reviewed_at)];

    const subjMap = new Map((subjects.data ?? []).map((s) => [s.id, s]));
    const bySubject = [...groupMinutesBySubject(study).entries()]
      .filter(([, m]) => m > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, m]) => {
        const s = id ? subjMap.get(id) : null;
        return { name: s?.name ?? "No subject", value: Math.round(m), color: s ? colorFor(s.color).hex : "#a8a49c" };
      });

    const completionByWeek = Array.from({ length: 6 }, (_, i) => {
      const ws = addWeeks(startOfWeek(new Date()), -(5 - i));
      const we = addWeeks(ws, 1);
      const inWeek = (d: string | null) => !!d && new Date(d) >= ws && new Date(d) < we;
      return {
        label: format(ws, "MMM d"),
        completed: allA.filter((a) => inWeek(a.completed_at)).length,
        dueOpen: allA.filter((a) => a.status !== "completed" && inWeek(a.due_date)).length,
      };
    });

    const revisionWeek = weeklyBuckets((reviews.data ?? []).map((r) => ({ at: r.reviewed_at, minutes: 1 })), startOfWeek(new Date()));

    return {
      study,
      totalFocusMin,
      completedA: allA.filter((a) => a.status === "completed").length,
      pendingA: allA.filter((a) => a.status !== "completed").length,
      overdueA: allA.filter((a) => isOverdue(a.due_date, a.status)).length,
      sessionsDone: completedSessions.length,
      reviewsCount: (reviews.data ?? []).length,
      streak: currentStreak(activityDates),
      consistency: consistencyByWeek(activityDates, WEEKS),
      bySubject,
      completionByWeek,
      revisionWeek,
      subjectProgress: (subjects.data ?? []).map((s) => ({ s, pct: chapterProgress(s.chapters.map((c) => c.status)), total: s.chapters.length })),
    };
  }, [loading, error, focus.data, sessions.data, assignments.data, reviews.data, subjects.data]);

  const weekStart = addWeeks(startOfWeek(new Date()), weekOffset);
  const weekly = data ? weeklyBuckets(data.study, weekStart) : [];
  const weekTotal = weekly.reduce((a, b) => a + b.minutes, 0);

  if (error) return <div><PageHeader title="My Progress" /><ErrorState error={error} onRetry={() => { focus.refetch(); sessions.refetch(); assignments.refetch(); reviews.refetch(); subjects.refetch(); }} /></div>;

  return (
    <div>
      <PageHeader title="My Progress" description={`Calculated from your saved activity. Study time = completed focus sessions + completed planned sessions (last ${WEEKS} weeks for charts).`} />
      {loading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric icon={Clock} label="Total focus hours" value={(data.totalFocusMin / 60).toFixed(1)} />
            <Metric icon={CheckCircle2} label="Assignments completed" value={String(data.completedA)} sub={data.overdueA ? `${data.overdueA} overdue` : `${data.pendingA} open`} />
            <Metric icon={CalendarCheck} label="Sessions completed" value={String(data.sessionsDone)} sub={`last ${WEEKS} weeks`} />
            <Metric icon={Layers} label="Flashcards reviewed" value={String(data.reviewsCount)} sub={`last ${WEEKS} weeks`} />
            <Metric icon={Flame} label="Current streak" value={`${data.streak} day${data.streak === 1 ? "" : "s"}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Weekly study time</CardTitle>
                  <CardDescription>{format(weekStart, "MMM d")} – {format(addWeeks(weekStart, 1).getTime() - 86_400_000, "MMM d")} · {fmtMinutes(weekTotal)}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon-sm" disabled={weekOffset <= -(WEEKS - 1)} onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week"><ChevronLeft /></Button>
                  <Button variant="outline" size="icon-sm" disabled={weekOffset >= 0} onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week"><ChevronRight /></Button>
                </div>
              </CardHeader>
              <CardContent>{weekTotal === 0 ? <EmptyState compact icon={BarChart3} title="No study time logged this week" /> : <MinutesBarChart data={weekly} height={220} />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Subject distribution</CardTitle><CardDescription>Study time by subject</CardDescription></div></CardHeader>
              <CardContent>
                {data.bySubject.length === 0 ? <EmptyState compact icon={BarChart3} title="No study time yet" /> : (
                  <>
                    <DonutChart data={data.bySubject} height={170} />
                    <ul className="mt-3 space-y-1.5">
                      {data.bySubject.slice(0, 6).map((d) => (
                        <li key={d.name} className="flex items-center gap-2 text-[13px]">
                          <span className="size-2 rounded-full" style={{ background: d.color }} />
                          <span className="flex-1 truncate">{d.name}</span>
                          <span className="tabular-nums text-muted-foreground">{fmtMinutes(d.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><div><CardTitle>Assignment completion</CardTitle><CardDescription>Completed per week vs. still open (by due week)</CardDescription></div></CardHeader>
              <CardContent>
                {data.completionByWeek.every((w) => w.completed === 0 && w.dueOpen === 0) ? <EmptyState compact icon={CheckCircle2} title="No assignment activity in the last 6 weeks" /> : (
                  <StackedBarChart data={data.completionByWeek} keys={[{ key: "completed", label: "Completed", color: "var(--chart-1)" }, { key: "dueOpen", label: "Still open", color: "var(--chart-3)" }]} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Study consistency</CardTitle><CardDescription>Active days per week</CardDescription></div></CardHeader>
              <CardContent>
                {data.consistency.every((w) => w.activeDays === 0) ? <EmptyState compact icon={Flame} title="No activity yet" /> : <ConsistencyLine data={data.consistency} height={200} />}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Subject progress</CardTitle></CardHeader>
              <CardContent>
                {data.subjectProgress.length === 0 ? <EmptyState compact icon={BarChart3} title="No subjects yet" /> : (
                  <ul className="space-y-3.5">
                    {data.subjectProgress.map(({ s, pct, total }) => (
                      <li key={s.id}>
                        <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                          <SubjectDot color={s.color} />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="tabular-nums text-muted-foreground">{total ? `${pct}%` : "No chapters"}</span>
                        </div>
                        <Progress value={pct} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Revision activity</CardTitle><CardDescription>Flashcard reviews this week</CardDescription></div></CardHeader>
              <CardContent>
                {data.revisionWeek.every((d) => d.minutes === 0) ? <EmptyState compact icon={Layers} title="No reviews this week" /> : (
                  <StackedBarChart data={data.revisionWeek.map((d) => ({ label: d.day, reviews: d.minutes }))} keys={[{ key: "reviews", label: "Reviews", color: "var(--chart-2)" }]} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
