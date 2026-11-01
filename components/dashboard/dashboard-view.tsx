"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FilePlus2,
  GraduationCap,
  Library,
  ListTodo,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Progress, Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/common/page";
import { SubjectDot, SubjectTag } from "@/components/common/subject";
import { MinutesBarChart } from "@/components/progress/charts";
import { AssignmentDialog } from "@/components/assignments/assignment-dialog";
import { SubjectDialog } from "@/components/subjects/subject-dialog";
import { SessionDialog } from "@/components/schedule/session-dialog";
import { useAssignments, useExams, useFocusSessions, useProfile, useSessions, useSubjects } from "@/hooks/use-data";
import { useSetAssignmentStatus, useSetSessionStatus } from "@/hooks/use-actions";
import { sessionMinutes, startOfDay, startOfWeek, sumMinutes, weeklyBuckets, chapterProgress, type MinutesRecord } from "@/lib/logic/analytics";
import { daysUntil, fmtDue, fmtMinutes, fmtRelativeDay, fmtTime, greeting, isOverdue, PRIORITY_BADGE, PRIORITY_LABEL } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function DashboardView() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [dialog, setDialog] = useState<"assignment" | "subject" | "session" | null>(null);

  const now = new Date();
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => new Date(weekStart.getTime() + 7 * 86_400_000), [weekStart]);
  const horizon = useMemo(() => new Date(todayStart.getTime() + 14 * 86_400_000), [todayStart]);

  const assignments = useAssignments();
  const subjects = useSubjects();
  const exams = useExams();
  const sessions = useSessions(weekStart < todayStart ? weekStart : todayStart, horizon > weekEnd ? horizon : weekEnd);
  const focus = useFocusSessions(weekStart);
  const subjectMap = new Map((subjects.data ?? []).map((s) => [s.id, s]));

  const setAssignment = useSetAssignmentStatus();
  const setSession = useSetSessionStatus();

  // Study time = completed focus sessions + completed planned sessions (real records only).
  const studyRecords: MinutesRecord[] = [
    ...(focus.data ?? []).map((f) => ({ at: f.completed_at, minutes: f.duration_minutes, subjectId: f.subject_id })),
    ...(sessions.data ?? []).filter((s) => s.status === "completed").map((s) => ({ at: s.start_time, minutes: sessionMinutes(s.start_time, s.end_time), subjectId: s.subject_id })),
  ];
  const todayMinutes = sumMinutes(studyRecords, todayStart, new Date(todayStart.getTime() + 86_400_000));
  const weekly = weeklyBuckets(studyRecords, weekStart);
  const weekTotal = weekly.reduce((a, b) => a + b.minutes, 0);

  const allA = assignments.data ?? [];
  const pending = allA.filter((a) => a.status !== "completed");
  const dueToday = pending.filter((a) => new Date(a.due_date).toDateString() === now.toDateString());
  const completedCount = allA.filter((a) => a.status === "completed").length;
  const priority = pending
    .filter((a) => a.priority === "high" || isOverdue(a.due_date, a.status))
    .sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date))
    .slice(0, 6);
  const upcomingExams = (exams.data ?? []).filter((e) => new Date(e.exam_date) >= todayStart);
  const todaySessions = (sessions.data ?? []).filter((s) => new Date(s.start_time).toDateString() === now.toDateString());

  const upcoming = [
    ...pending.filter((a) => new Date(a.due_date) >= now).map((a) => ({ id: a.id, kind: "Assignment" as const, title: a.title, at: a.due_date, subjectId: a.subject_id, href: `/assignments?open=${a.id}` })),
    ...upcomingExams.map((e) => ({ id: e.id, kind: "Exam" as const, title: e.title, at: e.exam_date, subjectId: e.subject_id, href: `/exams?exam=${e.id}` })),
    ...(sessions.data ?? []).filter((s) => s.status === "planned" && new Date(s.start_time) > now).map((s) => ({ id: s.id, kind: "Session" as const, title: s.title, at: s.start_time, subjectId: s.subject_id, href: "/schedule" })),
  ]
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))
    .slice(0, 7);

  const loadingCore = assignments.isLoading || sessions.isLoading || focus.isLoading || exams.isLoading;
  const coreError = assignments.error || sessions.error || focus.error || exams.error;
  const isNew = !subjects.isLoading && (subjects.data?.length ?? 0) === 0 && allA.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting(now)}{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
      </div>

      {/* G. Quick actions */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <QuickAction icon={FilePlus2} label="Add note" onClick={() => router.push("/notes?new=1")} />
        <QuickAction icon={ListTodo} label="Create assignment" onClick={() => setDialog("assignment")} />
        <QuickAction icon={Library} label="Add subject" onClick={() => setDialog("subject")} />
        <QuickAction icon={CalendarPlus} label="Plan session" onClick={() => setDialog("session")} />
        <QuickAction icon={Timer} label="Start focus" onClick={() => router.push("/focus")} />
        <QuickAction icon={Sparkles} label="Ask AI" onClick={() => router.push("/ai")} />
      </div>

      {isNew && (
        <Card className="border-primary/25 bg-primary-soft/40">
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Your workspace is ready</p>
              <p className="text-[13px] text-muted-foreground">Start by adding a subject, then an assignment or a note. Everything here updates from what you add.</p>
            </div>
            <Button size="sm" onClick={() => setDialog("subject")}><Plus /> Add your first subject</Button>
          </CardContent>
        </Card>
      )}

      {coreError ? (
        <ErrorState error={coreError} onRetry={() => { assignments.refetch(); sessions.refetch(); focus.refetch(); exams.refetch(); }} />
      ) : (
        <>
          {/* A. Today's overview */}
          <section aria-label="Today's overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat loading={loadingCore} icon={ListTodo} label="Due today" value={String(dueToday.length)} tone="sand" />
            <Stat
              loading={loadingCore}
              icon={Clock}
              label="Studied today"
              value={fmtMinutes(todayMinutes)}
              sub={profile?.daily_goal_minutes ? `of ${fmtMinutes(profile.daily_goal_minutes)} goal` : undefined}
              tone="sage"
              progress={profile?.daily_goal_minutes ? (todayMinutes / profile.daily_goal_minutes) * 100 : undefined}
            />
            <Stat loading={loadingCore} icon={GraduationCap} label="Upcoming exams" value={String(upcomingExams.length)} tone="lavender" />
            <Stat loading={loadingCore} icon={CheckCircle2} label="Completed assignments" value={String(completedCount)} tone="sage" />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* B. Today's schedule */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Today&apos;s schedule</CardTitle>
                <Button variant="ghost" size="sm" asChild><Link href="/schedule">Open calendar</Link></Button>
              </CardHeader>
              <CardContent>
                {sessions.isLoading ? <ListSkeleton /> : todaySessions.length === 0 ? (
                  <EmptyState compact icon={CalendarClock} title="Nothing scheduled today" description="Plan a study session or let the scheduler suggest one." action={<Button size="sm" variant="outline" onClick={() => setDialog("session")}>Plan a session</Button>} />
                ) : (
                  <ul className="divide-y divide-border">
                    {todaySessions.map((s) => {
                      const done = s.status === "completed";
                      return (
                        <li key={s.id} className="flex items-center gap-3 py-2.5">
                          <Checkbox checked={done} label={`Mark ${s.title} complete`} disabled={setSession.isPending} onCheckedChange={(v) => setSession.mutate({ id: s.id, status: v ? "completed" : "planned" })} />
                          <div className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtTime(s.start_time)}</div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm", done && "text-muted-foreground line-through")}>{s.title}</p>
                            <div className="mt-0.5 flex items-center gap-2"><SubjectTag subject={s.subject_id ? subjectMap.get(s.subject_id) : null} /></div>
                          </div>
                          <span className="text-xs text-muted-foreground">{fmtMinutes(sessionMinutes(s.start_time, s.end_time))}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* C. Priority tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Priority tasks</CardTitle>
                <Button variant="ghost" size="sm" asChild><Link href="/assignments">All</Link></Button>
              </CardHeader>
              <CardContent>
                {assignments.isLoading ? <ListSkeleton /> : priority.length === 0 ? (
                  <EmptyState compact icon={CheckCircle2} title="No urgent tasks" description="High-priority and overdue assignments show up here." />
                ) : (
                  <ul className="space-y-1">
                    {priority.map((a) => {
                      const overdue = isOverdue(a.due_date, a.status);
                      return (
                        <li key={a.id} className="flex items-start gap-3 rounded-md py-1.5">
                          <Checkbox className="mt-0.5" checked={false} label={`Complete ${a.title}`} disabled={setAssignment.isPending} onCheckedChange={() => setAssignment.mutate({ id: a.id, status: "completed" })} />
                          <div className="min-w-0 flex-1">
                            <Link href={`/assignments?open=${a.id}`} className="block truncate text-sm hover:underline">{a.title}</Link>
                            <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                              {overdue ? "Overdue · " : ""}{fmtDue(a.due_date)}
                            </p>
                          </div>
                          <Badge variant={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* E. Weekly study activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Weekly study activity</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fmtMinutes(weekTotal)} this week · focus sessions + completed study sessions</p>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCore ? <Skeleton className="h-[200px]" /> : weekTotal === 0 ? (
                  <EmptyState compact icon={Timer} title="No study time logged this week" description="Complete a focus session or mark a planned session done to see it here." action={<Button size="sm" variant="outline" asChild><Link href="/focus">Start a focus session</Link></Button>} />
                ) : (
                  <MinutesBarChart data={weekly} />
                )}
              </CardContent>
            </Card>

            {/* F. Upcoming events */}
            <Card>
              <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
              <CardContent>
                {loadingCore ? <ListSkeleton /> : upcoming.length === 0 ? (
                  <EmptyState compact icon={CalendarClock} title="Nothing coming up" description="Assignments, exams and planned sessions will appear here." />
                ) : (
                  <ul className="space-y-2.5">
                    {upcoming.map((u) => (
                      <li key={`${u.kind}-${u.id}`}>
                        <Link href={u.href} className="flex items-start gap-3 rounded-md hover:bg-accent/60">
                          <div className="w-14 shrink-0 pt-0.5 text-[11px] font-medium uppercase text-muted-foreground">{fmtRelativeDay(u.at)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{u.title}</p>
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {u.subjectId && <SubjectDot color={subjectMap.get(u.subjectId)?.color} />}
                              {u.kind}{u.kind === "Exam" ? ` · in ${daysUntil(u.at)}d` : ` · ${fmtTime(u.at)}`}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* D. My subjects */}
          <Card>
            <CardHeader>
              <CardTitle>My subjects</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link href="/subjects">Manage</Link></Button>
            </CardHeader>
            <CardContent>
              {subjects.isLoading ? <ListSkeleton /> : subjects.error ? <ErrorState error={subjects.error} onRetry={() => subjects.refetch()} /> : (subjects.data ?? []).length === 0 ? (
                <EmptyState compact icon={BookOpen} title="No subjects yet" action={<Button size="sm" variant="outline" onClick={() => setDialog("subject")}>Add a subject</Button>} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(subjects.data ?? []).map((s) => {
                    const pct = chapterProgress(s.chapters.map((c) => c.status));
                    return (
                      <Link key={s.id} href={`/subjects/${s.id}`} className="rounded-lg border border-border p-3.5 transition-colors hover:bg-surface">
                        <div className="flex items-center gap-2">
                          <SubjectDot color={s.color} className="size-2.5" />
                          <p className="truncate text-sm font-medium">{s.name}</p>
                          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} className="mt-3" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {s.chapters.length} chapter{s.chapters.length === 1 ? "" : "s"} · {s.notes[0]?.count ?? 0} note{(s.notes[0]?.count ?? 0) === 1 ? "" : "s"}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AssignmentDialog open={dialog === "assignment"} onOpenChange={(v) => setDialog(v ? "assignment" : null)} />
      <SubjectDialog open={dialog === "subject"} onOpenChange={(v) => setDialog(v ? "subject" : null)} />
      <SessionDialog open={dialog === "session"} onOpenChange={(v) => setDialog(v ? "session" : null)} defaultMinutes={profile?.session_minutes} />
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-soft transition-colors hover:bg-surface">
      <Icon className="size-4 text-primary" />
      {label}
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
  progress,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: "sage" | "lavender" | "sand";
  loading?: boolean;
  progress?: number;
}) {
  const toneCls = tone === "sage" ? "bg-primary-soft text-primary" : tone === "lavender" ? "bg-lavender-soft text-lavender" : "bg-sand-soft text-sand";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-md", toneCls)}><Icon className="size-4" /></span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {loading ? <Skeleton className="mt-3 h-7 w-16" /> : <p className="mt-2.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>}
      {sub && !loading && <p className="text-xs text-muted-foreground">{sub}</p>}
      {progress !== undefined && !loading && <Progress value={progress} className="mt-2" />}
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}
    </div>
  );
}
