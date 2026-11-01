"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/misc";
import { SubjectSelect } from "@/components/common/subject";
import { useChapters } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { saveExam, type ExamInput, type ExamWithChapters } from "@/lib/data/planner";
import { qk } from "@/lib/data/core";
import { examSchema, validate, type FieldErrors } from "@/lib/validations";
import { EXAM_TYPE_LABEL, fromLocalInput, toLocalInput } from "@/lib/utils/format";
import { EXAM_TYPES } from "@/types/database";

export function ExamDialog({ open, onOpenChange, exam, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; exam?: ExamWithChapters | null; onSaved?: (id: string) => void }) {
  const [subjectId, setSubjectId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FieldErrors>({});
  const chapters = useChapters(subjectId || undefined);

  useEffect(() => {
    if (open) {
      setSubjectId(exam?.subject_id ?? "");
      setPicked(new Set(exam?.exam_chapters.map((c) => c.chapter_id) ?? []));
      setErrors({});
    }
  }, [open, exam]);

  const save = useDbMutation((sb, v: { input: ExamInput; chapterIds: string[] }) => saveExam(sb, v.input, v.chapterIds, exam?.id), {
    invalidate: [qk.exams],
    success: exam ? "Exam updated" : "Exam added",
    onSuccess: (e) => { onOpenChange(false); onSaved?.(e.id); },
  });

  const defaultDate = () => { const d = new Date(); d.setDate(d.getDate() + 14); d.setHours(9, 0, 0, 0); return toLocalInput(d); };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(examSchema, { title: fd.get("title"), subject_id: subjectId, exam_date: fd.get("exam_date"), exam_type: fd.get("exam_type"), notes: fd.get("notes") });
    if (!v.ok) return setErrors(v.errors);
    const validIds = new Set((chapters.data ?? []).map((c) => c.id));
    save.mutate({ input: { ...v.data, exam_date: fromLocalInput(v.data.exam_date) }, chapterIds: [...picked].filter((id) => validIds.has(id)) });
  }

  const list = chapters.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{exam ? "Edit exam" : "New exam"}</DialogTitle></DialogHeader>
        <form key={exam?.id ?? "new"} onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Exam title" htmlFor="e-title" error={errors.title}>
            <Input id="e-title" name="title" defaultValue={exam?.title} placeholder="e.g. Physics mid-term" autoFocus maxLength={160} aria-invalid={!!errors.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject" htmlFor="e-subject">
              <SubjectSelect id="e-subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPicked(new Set()); }} />
            </Field>
            <Field label="Type" htmlFor="e-type">
              <NativeSelect id="e-type" name="exam_type" defaultValue={exam?.exam_type ?? "unit_test"}>
                {EXAM_TYPES.map((t) => <option key={t} value={t}>{EXAM_TYPE_LABEL[t]}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Date & time" htmlFor="e-date" error={errors.exam_date}>
            <Input id="e-date" name="exam_date" type="datetime-local" defaultValue={exam ? toLocalInput(exam.exam_date) : defaultDate()} aria-invalid={!!errors.exam_date} />
          </Field>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Syllabus chapters</Label>
              {list.length > 0 && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setPicked(picked.size === list.length ? new Set() : new Set(list.map((c) => c.id)))}>
                  {picked.size === list.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            {!subjectId ? (
              <p className="text-[13px] text-muted-foreground">Choose a subject to pick chapters from its chapter list.</p>
            ) : chapters.isLoading ? (
              <p className="text-[13px] text-muted-foreground">Loading chapters…</p>
            ) : list.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">This subject has no chapters yet. Add them on the subject page.</p>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {list.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1 text-sm hover:bg-accent">
                    <Checkbox checked={picked.has(c.id)} label={c.title} onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })} />
                    <span className="truncate">{c.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <Field label="Notes" htmlFor="e-notes" optional error={errors.notes}>
            <Textarea id="e-notes" name="notes" defaultValue={exam?.notes ?? ""} rows={2} maxLength={2000} placeholder="Venue, allowed materials, format…" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{exam ? "Save changes" : "Add exam"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
