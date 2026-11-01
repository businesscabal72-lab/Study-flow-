"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDays } from "date-fns";
import { CalendarRange, GraduationCap, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Checkbox, Progress, Skeleton } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SubjectTag } from "@/components/common/subject";
import { ExamDialog } from "./exam-dialog";
import { PlanReviewDialog } from "@/components/schedule/plan-review-dialog";
import { useExams, useProfile, useSubjectMap } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { deleteExam, listSessions, setExamChapterStatus, type ExamWithChapters } from "@/lib/data/planner";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { planRevision, type RevisionChapter, type Suggestion } from "@/lib/logic/scheduler";
import { availabilityFromProfile } from "@/lib/logic/availability";
import { CHAPTER_STATUS_BADGE, CHAPTER_STATUS_LABEL, daysUntil, errorMessage, EXAM_TYPE_LABEL, fmtDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { CHAPTER_STATUSES, type ChapterStatus } from "@/types/database";

function examStats(e: ExamWithChapters) {
  const total = e.exam_chapters.length;
  const completed = e.exam_chapters.filter((c) => c.revision_status === "completed").length;
  const revision = e.exam_chapters.filter((c) => c.revision_status === "needs_revision").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const prep = total === 0 ? "No syllabus yet" : completed === total ? "Syllabus covered" : completed === 0 && e.exam_chapters.every((c) => c.revision_status === "not_started") ? "Not started" : "In progress";
  return { total, completed, revision, pct, prep };
}

export function ExamsView() {
  const params = useSearchParams();
  const exams = useExams();
  const { map: subjects } = useSubjectMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ exam?: ExamWithChapters | null } | null>(null);
  const [deleting, setDeleting] = useState<ExamWithChapters | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const id = params.get("exam");
    if (id) setSelectedId(id);
  }, [params]);

  const del = useDbMutation((sb, id: string) => deleteExam(sb, id), { invalidate: [qk.exams], success: "Exam deleted", onSuccess: () => { setDeleting(null); setSelectedId(null); } });

  const all = exams.data ?? [];
  const upcoming = all.filter((e) => daysUntil(e.exam_date) >= 0);
  const past = all.filter((e) => daysUntil(e.exam_date) < 0).reverse();
  const list = showPast ? past : upcoming;
  const selected = all.find((e) => e.id === selectedId) ?? (upcoming[0] ?? null);

  return (
    <div>
      <PageHeader title="Exam Center" description="Track syllabus coverage and plan revision before each exam." actions={<Button onClick={() => setDialog({})}><Plus /> New exam</Button>} />
      {exams.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><Skeleton className="h-64" /><Skeleton className="h-96" /></div>
      ) : exams.error ? (
        <ErrorState error={exams.error} onRetry={() => exams.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No exams yet" description="Add an exam and pick its syllabus chapters to track your preparation." action={<Button onClick={() => setDialog({})}><Plus /> Add an exam</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div>
            <div className="mb-2 flex gap-1 rounded-lg bg-muted p-0.5 text-[13px]">
              {[["Upcoming", false], ["Past", true]].map(([label, v]) => (
                <button key={String(label)} onClick={() => setShowPast(v as boolean)} className={cn("flex-1 rounded-md py-1.5", showPast === v ? "bg-background font-medium shadow-soft" : "text-muted-foreground")}>
                  {label as string} ({(v ? past : upcoming).length})
                </button>
              ))}
            </div>
            {list.length === 0 ? (
              <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">{showPast ? "No past exams." : "No upcoming exams."}</p>
            ) : (
              <ul className="space-y-2">
                {list.map((e) => {
                  const st = examStats(e);
                  const d = daysUntil(e.exam_date);
                  return (
                    <li key={e.id}>
                      <button onClick={() => setSelectedId(e.id)} className={cn("w-full rounded-xl border p-3.5 text-left transition-colors", selected?.id === e.id ? "border-primary/40 bg-primary-soft/30" : "border-border bg-card hover:bg-surface")}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{e.title}</p>
                          <Badge variant={d < 0 ? "default" : d <= 3 ? "destructive" : d <= 7 ? "warning" : "lavender"}>{d < 0 ? "Done" : d === 0 ? "Today" : `${d}d`}</Badge>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <SubjectTag subject={e.subject_id ? subjects.get(e.subject_id) : null} />
                          <span>{EXAM_TYPE_LABEL[e.exam_type]}</span>
                        </div>
                        <Progress value={st.pct} className="mt-3" tone="lavender" />
                        <p className="mt-1.5 text-xs text-muted-foreground">{st.completed}/{st.total} chapters · {st.prep}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {selected ? (
            <ExamDetail key={selected.id} exam={selected} onEdit={() => setDialog({ exam: selected })} onDelete={() => setDeleting(selected)} />
          ) : (
            <EmptyState icon={GraduationCap} title="Select an exam" />
          )}
        </div>
      )}
      <ExamDialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} exam={dialog?.exam} onSaved={(id) => setSelectedId(id)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)} title="Delete exam?" description={`“${deleting?.title}” and its syllabus checklist will be deleted. Chapters stay in the subject.`} loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </div>
  );
}

function ExamDetail({ exam, onEdit, onDelete }: { exam: ExamWithChapters; onEdit: () => void; onDelete: () => void }) {
  const { data: profile } = useProfile();
  const { map: subjects } = useSubjectMap();
  const [plan, setPlan] = useState<{ suggestions: Suggestion[]; unscheduled: RevisionChapter[] } | null>(null);
  const [planning, setPlanning] = useState(false);
  const st = examStats(exam);
  const d = daysUntil(exam.exam_date);

  const setStatus = useDbMutation(
    (sb, v: { id: string; chapterId: string; status: ChapterStatus }) => setExamChapterStatus(sb, v.id, v.chapterId, v.status),
    { invalidate: [qk.exams, qk.chapters(), qk.subjects] }
  );

  const chapters = [...exam.exam_chapters].sort((a, b) => (a.chapters?.title ?? "").localeCompare(b.chapters?.title ?? "", undefined, { numeric: true }));

  async function openPlanner() {
    setPlanning(true);
    try {
      const now = new Date();
      const examDate = new Date(exam.exam_date);
      const existing = await listSessions(getSupabaseBrowser(), now, addDays(examDate, 1));
      const res = planRevision({
        now,
        examDate,
        chapters: chapters.map((c) => ({ id: c.chapter_id, title: c.chapters?.title ?? "Chapter", status: c.revision_status })),
        availability: availabilityFromProfile(profile),
        busy: existing.filter((s) => s.status !== "skipped").map((s) => ({ start: new Date(s.start_time), end: new Date(s.end_time) })),
        subjectId: exam.subject_id,
        examTitle: exam.title,
      });
      setPlan({ suggestions: res.plan, unscheduled: res.unscheduled });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPlanning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="items-start pt-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{exam.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <SubjectTag subject={exam.subject_id ? subjects.get(exam.subject_id) : null} />
            <span>{EXAM_TYPE_LABEL[exam.exam_type]}</span>
            <span>·</span>
            <span>{fmtDateTime(exam.exam_date)}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Exam actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit exam & syllabus</DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Days remaining" value={d < 0 ? "—" : String(d)} highlight={d >= 0 && d <= 3} />
          <Metric label="Chapters completed" value={`${st.completed}/${st.total}`} />
          <Metric label="Need revision" value={String(st.revision)} warn={st.revision > 0} />
          <Metric label="Syllabus progress" value={`${st.pct}%`} />
        </div>
        <div>
          <Progress value={st.pct} tone="lavender" className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">Progress reflects chapters you&apos;ve marked completed — it isn&apos;t a prediction of your result.</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Syllabus checklist</h3>
            {d >= 0 && st.total > st.completed && (
              <Button size="sm" variant="soft" onClick={openPlanner} loading={planning}><CalendarRange /> Plan revision</Button>
            )}
          </div>
          {chapters.length === 0 ? (
            <EmptyState compact icon={GraduationCap} title="No syllabus chapters" description="Edit the exam to pick which chapters it covers." action={<Button size="sm" variant="outline" onClick={onEdit}>Choose chapters</Button>} />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {chapters.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={c.revision_status === "completed"}
                    label={`Mark ${c.chapters?.title} completed`}
                    onCheckedChange={(v) => setStatus.mutate({ id: c.id, chapterId: c.chapter_id, status: v ? "completed" : "learning" })}
                  />
                  <span className={cn("min-w-0 flex-1 truncate text-sm", c.revision_status === "completed" && "text-muted-foreground line-through")}>{c.chapters?.title ?? "Deleted chapter"}</span>
                  <Badge variant={CHAPTER_STATUS_BADGE[c.revision_status]} className="hidden sm:inline-flex">{CHAPTER_STATUS_LABEL[c.revision_status]}</Badge>
                  <NativeSelect
                    aria-label={`Status of ${c.chapters?.title}`}
                    value={c.revision_status}
                    onChange={(e) => setStatus.mutate({ id: c.id, chapterId: c.chapter_id, status: e.target.value as ChapterStatus })}
                    className="h-8 w-[140px] text-[13px]"
                  >
                    {CHAPTER_STATUSES.map((s) => <option key={s} value={s}>{CHAPTER_STATUS_LABEL[s]}</option>)}
                  </NativeSelect>
                </li>
              ))}
            </ul>
          )}
        </div>
        {exam.notes && <p className="whitespace-pre-line rounded-lg bg-surface p-3 text-[13px] text-muted-foreground">{exam.notes}</p>}
      </CardContent>
      <PlanReviewDialog
        open={!!plan}
        onOpenChange={(v) => !v && setPlan(null)}
        title={`Revision plan · ${exam.title}`}
        description="Unfinished chapters spread across your free study time before the exam, chapters needing revision first. Adjust anything before saving."
        suggestions={plan?.suggestions ?? []}
        emptyMessage="There are no free study blocks before this exam within your availability. Try widening your study window in Settings."
        footerNote={
          plan && plan.unscheduled.length > 0 ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
              {plan.unscheduled.length} chapter{plan.unscheduled.length === 1 ? "" : "s"} didn&apos;t fit in your available time: {plan.unscheduled.map((c) => c.title).join(", ")}.
            </p>
          ) : null
        }
      />
    </Card>
  );
}

function Metric({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className={cn("text-xl font-semibold tabular-nums", highlight && "text-destructive", warn && "text-warning")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
