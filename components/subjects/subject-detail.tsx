"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Progress, Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/common/page";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SubjectDialog } from "./subject-dialog";
import { AssignmentDialog } from "@/components/assignments/assignment-dialog";
import { useAssignments, useChapters, useExams, useNotes, useResources, useSubject } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { useSetAssignmentStatus } from "@/hooks/use-actions";
import { createChapter, createResource, deleteChapter, deleteResource, deleteSubject, updateChapter } from "@/lib/data/subjects";
import { createNote, attachmentUrl } from "@/lib/data/notes";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { chapterProgress } from "@/lib/logic/analytics";
import { chapterSchema, resourceSchema, validate, type FieldErrors } from "@/lib/validations";
import {
  CHAPTER_STATUS_BADGE,
  CHAPTER_STATUS_LABEL,
  daysUntil,
  EXAM_TYPE_LABEL,
  errorMessage,
  fmtAgo,
  fmtDate,
  fmtDue,
  isOverdue,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
} from "@/lib/utils/format";
import { colorFor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import { CHAPTER_STATUSES, type Chapter, type ChapterStatus } from "@/types/database";
import { Checkbox } from "@/components/ui/misc";

export function SubjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const subject = useSubject(id);
  const chapters = useChapters(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const del = useDbMutation((sb) => deleteSubject(sb, id), {
    invalidate: [qk.subjects, qk.notes, qk.assignments, qk.exams],
    success: "Subject deleted",
    onSuccess: () => router.replace("/subjects"),
  });

  if (subject.isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-64" /></div>;
  if (subject.error || !subject.data)
    return <ErrorState error={subject.error ?? new Error("Subject not found")} onRetry={() => subject.refetch()} />;

  const s = subject.data;
  const c = colorFor(s.color);
  const pct = chapterProgress((chapters.data ?? []).map((x) => x.status));

  return (
    <div>
      <Link href="/subjects" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Subjects
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={cn("mt-1.5 size-3.5 shrink-0 rounded-full", c.dot)} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
            {s.teacher_name && <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground"><User className="size-3.5" /> {s.teacher_name}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive-soft" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete</Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chapters"><ListChecks /> Chapters</TabsTrigger>
          <TabsTrigger value="notes"><BookOpen /> Notes</TabsTrigger>
          <TabsTrigger value="assignments"><ClipboardList /> Assignments</TabsTrigger>
          <TabsTrigger value="resources"><Link2 /> Resources</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview subjectId={id} description={s.description} chapters={chapters.data ?? []} pct={pct} /></TabsContent>
        <TabsContent value="chapters"><Chapters subjectId={id} chapters={chapters.data} loading={chapters.isLoading} error={chapters.error} /></TabsContent>
        <TabsContent value="notes"><SubjectNotes subjectId={id} /></TabsContent>
        <TabsContent value="assignments"><SubjectAssignments subjectId={id} /></TabsContent>
        <TabsContent value="resources"><Resources subjectId={id} /></TabsContent>
      </Tabs>

      <SubjectDialog open={editOpen} onOpenChange={setEditOpen} subject={s} onSaved={() => subject.refetch()} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${s.name}?`}
        description="Chapters and resources will be deleted. Notes, assignments, exams and flashcards are kept but unlinked."
        loading={del.isPending}
        onConfirm={() => del.mutate(undefined)}
      />
    </div>
  );
}

function Overview({ subjectId, description, chapters, pct }: { subjectId: string; description: string | null; chapters: Chapter[]; pct: number }) {
  const exams = useExams();
  const assignments = useAssignments();
  const notes = useNotes();
  const subjectExams = (exams.data ?? []).filter((e) => e.subject_id === subjectId && daysUntil(e.exam_date) >= 0);
  const pending = (assignments.data ?? []).filter((a) => a.subject_id === subjectId && a.status !== "completed");
  const noteCount = (notes.data ?? []).filter((n) => n.subject_id === subjectId).length;
  const counts = CHAPTER_STATUSES.map((st) => ({ st, n: chapters.filter((c) => c.status === st).length }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Learning progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-semibold tabular-nums">{pct}%</p>
            <p className="pb-1 text-[13px] text-muted-foreground">of {chapters.length} chapters completed</p>
          </div>
          <Progress value={pct} className="mt-3 h-2" />
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {counts.map(({ st, n }) => (
              <div key={st} className="rounded-lg bg-surface p-3">
                <p className="text-lg font-semibold tabular-nums">{n}</p>
                <p className="text-xs text-muted-foreground">{CHAPTER_STATUS_LABEL[st]}</p>
              </div>
            ))}
          </div>
          {description && <p className="mt-5 whitespace-pre-line text-sm text-muted-foreground">{description}</p>}
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle>Exams</CardTitle></CardHeader>
          <CardContent>
            {subjectExams.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No upcoming exams. <Link href="/exams" className="text-primary hover:underline">Add one</Link></p>
            ) : (
              <ul className="space-y-2">
                {subjectExams.map((e) => (
                  <li key={e.id}>
                    <Link href={`/exams?exam=${e.id}`} className="flex items-center gap-2 text-sm hover:underline">
                      <GraduationCap className="size-4 text-lavender" />
                      <span className="flex-1 truncate">{e.title}</span>
                      <Badge variant="lavender">{daysUntil(e.exam_date) === 0 ? "Today" : `${daysUntil(e.exam_date)}d`}</Badge>
                    </Link>
                    <p className="pl-6 text-xs text-muted-foreground">{EXAM_TYPE_LABEL[e.exam_type]} · {fmtDate(e.exam_date)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4"><p className="text-xl font-semibold tabular-nums">{pending.length}</p><p className="text-xs text-muted-foreground">Open assignments</p></div>
          <div className="p-4"><p className="text-xl font-semibold tabular-nums">{noteCount}</p><p className="text-xs text-muted-foreground">Notes</p></div>
        </Card>
      </div>
    </div>
  );
}

function Chapters({ subjectId, chapters, loading, error }: { subjectId: string; chapters?: Chapter[]; loading: boolean; error: unknown }) {
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string>();
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleting, setDeleting] = useState<Chapter | null>(null);
  const qc = useQueryClient();
  const inv = [qk.chapters(subjectId), qk.chapters(), qk.subjects, qk.exams];
  const add = useDbMutation((sb, t: string) => createChapter(sb, { subject_id: subjectId, title: t, position: (chapters?.length ?? 0) }), {
    invalidate: inv,
    onSuccess: () => setTitle(""),
  });
  const upd = useDbMutation((sb, v: { id: string; patch: Partial<Pick<Chapter, "title" | "status" | "position">> }) => updateChapter(sb, v.id, v.patch), { invalidate: inv });
  const del = useDbMutation((sb, id: string) => deleteChapter(sb, id), { invalidate: inv, success: "Chapter deleted", onSuccess: () => setDeleting(null) });

  const [moving, setMoving] = useState(false);
  const move = async (idx: number, dir: -1 | 1) => {
    if (!chapters || moving) return;
    if (!chapters[idx + dir]) return;
    setMoving(true);
    const sb = getSupabaseBrowser();
    try {
      // Normalise positions to list indexes, swapping the two moved chapters.
      await Promise.all(
        chapters.map((c, i) => {
          const pos = i === idx ? idx + dir : i === idx + dir ? idx : i;
          return c.position === pos ? null : updateChapter(sb, c.id, { position: pos });
        })
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      await qc.invalidateQueries({ queryKey: qk.chapters(subjectId) });
      setMoving(false);
    }
  };

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorState error={error} />;

  return (
    <Card>
      <CardContent className="pt-5">
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate(chapterSchema, { title });
            if (!v.ok) return setErr(v.errors.title);
            setErr(undefined);
            add.mutate(v.data.title);
          }}
        >
          <div className="flex-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a chapter, e.g. Electrostatics" aria-label="New chapter title" maxLength={120} aria-invalid={!!err} />
            {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
          </div>
          <Button type="submit" loading={add.isPending}><Plus /> Add</Button>
        </form>
        {(chapters ?? []).length === 0 ? (
          <EmptyState compact icon={ListChecks} title="No chapters yet" description="Break the subject into chapters to track what you've learned." />
        ) : (
          <ul className="divide-y divide-border">
            {chapters!.map((ch, i) => (
              <li key={ch.id} className="flex flex-wrap items-center gap-2 py-2.5 sm:flex-nowrap">
                <span className="w-6 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                {editing === ch.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = validate(chapterSchema, { title: editTitle });
                      if (!v.ok) return toast.error(v.errors.title);
                      upd.mutate({ id: ch.id, patch: { title: v.data.title } }, { onSuccess: () => setEditing(null) });
                    }}
                  >
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus maxLength={120} aria-label="Chapter title" className="h-8" />
                    <Button size="sm" type="submit" loading={upd.isPending}>Save</Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </form>
                ) : (
                  <p className={cn("min-w-0 flex-1 truncate text-sm", ch.status === "completed" && "text-muted-foreground")}>{ch.title}</p>
                )}
                <NativeSelect
                  aria-label={`Status of ${ch.title}`}
                  value={ch.status}
                  onChange={(e) => upd.mutate({ id: ch.id, patch: { status: e.target.value as ChapterStatus } })}
                  className="h-8 w-[150px] text-[13px]"
                >
                  {CHAPTER_STATUSES.map((st) => <option key={st} value={st}>{CHAPTER_STATUS_LABEL[st]}</option>)}
                </NativeSelect>
                <Badge variant={CHAPTER_STATUS_BADGE[ch.status]} className="hidden sm:inline-flex">{CHAPTER_STATUS_LABEL[ch.status]}</Badge>
                <div className="flex">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0 || moving} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === chapters!.length - 1 || moving} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Rename" onClick={() => { setEditing(ch.id); setEditTitle(ch.title); }}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(ch)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete “${deleting?.title}”?`}
        description="It will also be removed from any exam syllabus that includes it."
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </Card>
  );
}

function SubjectNotes({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const notes = useNotes();
  const create = useDbMutation((sb) => createNote(sb, { subject_id: subjectId }), {
    invalidate: [qk.notes, qk.subjects],
    onSuccess: (n) => router.push(`/notes?note=${n.id}`),
  });
  const list = (notes.data ?? []).filter((n) => n.subject_id === subjectId);
  if (notes.isLoading) return <Skeleton className="h-40" />;
  if (notes.error) return <ErrorState error={notes.error} onRetry={() => notes.refetch()} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => create.mutate(undefined)} loading={create.isPending}><Plus /> New note</Button></div>
      {list.length === 0 ? (
        <EmptyState icon={BookOpen} title="No notes for this subject" description="Notes you file under this subject will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((n) => (
            <Link key={n.id} href={`/notes?note=${n.id}`} className="rounded-lg border border-border p-4 hover:bg-surface">
              <p className="truncate text-sm font-medium">{n.title || "Untitled"}</p>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{n.content_text || "Empty note"}</p>
              <p className="mt-2 text-xs text-muted-foreground">Edited {fmtAgo(n.updated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectAssignments({ subjectId }: { subjectId: string }) {
  const assignments = useAssignments();
  const setStatus = useSetAssignmentStatus();
  const [open, setOpen] = useState(false);
  const list = (assignments.data ?? []).filter((a) => a.subject_id === subjectId);
  if (assignments.isLoading) return <Skeleton className="h-40" />;
  if (assignments.error) return <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus /> New assignment</Button></div>
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments for this subject" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {list.map((a) => {
              const overdue = isOverdue(a.due_date, a.status);
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <Checkbox checked={a.status === "completed"} label={`Toggle ${a.title}`} onCheckedChange={(v) => setStatus.mutate({ id: a.id, status: v ? "completed" : "not_started" })} />
                  <Link href={`/assignments?open=${a.id}`} className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", a.status === "completed" && "text-muted-foreground line-through")}>{a.title}</p>
                    <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>{overdue && "Overdue · "}{fmtDue(a.due_date)}</p>
                  </Link>
                  <Badge variant={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <AssignmentDialog open={open} onOpenChange={setOpen} defaultSubjectId={subjectId} />
    </div>
  );
}

function Resources({ subjectId }: { subjectId: string }) {
  const resources = useResources(subjectId);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formKey, setFormKey] = useState(0);
  const pdfs = useQuery({
    queryKey: ["subject-pdfs", subjectId],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("note_attachments")
        .select("id,file_name,storage_path,note_id,notes!inner(title,subject_id)")
        .eq("notes.subject_id", subjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; file_name: string; storage_path: string; note_id: string; notes: { title: string } }[];
    },
  });
  const add = useDbMutation((sb, v: { title: string; url: string }) => createResource(sb, { subject_id: subjectId, ...v }), {
    invalidate: [qk.resources(subjectId)],
    success: "Resource added",
    onSuccess: () => setFormKey((k) => k + 1),
  });
  const del = useDbMutation((sb, id: string) => deleteResource(sb, id), { invalidate: [qk.resources(subjectId)], success: "Resource removed" });

  const openPdf = async (path: string) => {
    try {
      window.open(await attachmentUrl(getSupabaseBrowser(), path), "_blank", "noopener");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Links</CardTitle></CardHeader>
        <CardContent>
          <form
            key={formKey}
            noValidate
            className="mb-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const v = validate(resourceSchema, { title: fd.get("title"), url: fd.get("url") });
              if (!v.ok) return setErrors(v.errors);
              setErrors({});
              add.mutate(v.data);
            }}
          >
            <Field label="Title" htmlFor="r-title" error={errors.title}><Input id="r-title" name="title" placeholder="Khan Academy — Kinematics" maxLength={120} /></Field>
            <Field label="URL" htmlFor="r-url" error={errors.url}><Input id="r-url" name="url" type="url" inputMode="url" placeholder="https://…" /></Field>
            <Button type="submit" size="sm" variant="secondary" loading={add.isPending} className="justify-self-start"><Plus /> Add link</Button>
          </form>
          {resources.isLoading ? <Skeleton className="h-16" /> : resources.error ? <ErrorState error={resources.error} /> : (resources.data ?? []).length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No links saved yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {resources.data!.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">{r.title}</a>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.title}`} onClick={() => del.mutate(r.id)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>PDFs from notes</CardTitle></CardHeader>
        <CardContent>
          {pdfs.isLoading ? <Skeleton className="h-16" /> : pdfs.error ? <ErrorState error={pdfs.error} /> : (pdfs.data ?? []).length === 0 ? (
            <p className="text-[13px] text-muted-foreground">PDFs attached to this subject&apos;s notes will be listed here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pdfs.data!.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-2">
                  <FileText className="size-4 shrink-0 text-destructive/80" />
                  <button onClick={() => openPdf(p.storage_path)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">{p.file_name}</button>
                  <Link href={`/notes?note=${p.note_id}`} className="max-w-[40%] truncate text-xs text-muted-foreground hover:underline">{p.notes.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
