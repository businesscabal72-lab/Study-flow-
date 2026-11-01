"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SubjectSelect } from "@/components/common/subject";
import { useDbMutation } from "@/hooks/use-mutation";
import { createSession, deleteSession, updateSession, type SessionInput } from "@/lib/data/planner";
import { qk } from "@/lib/data/core";
import { studySessionSchema, validate, type FieldErrors } from "@/lib/validations";
import { fromLocalInput, toLocalInput } from "@/lib/utils/format";
import type { SessionStatus, StudySession } from "@/types/database";

function defaultStart(date?: Date | null) {
  const d = date ? new Date(date) : new Date();
  if (!date || (d.getHours() === 0 && d.getMinutes() === 0)) {
    const now = new Date();
    if (date && d.toDateString() !== now.toDateString()) d.setHours(17, 0, 0, 0);
    else d.setHours(now.getHours() + 1, 0, 0, 0);
  }
  return d;
}

export function SessionDialog({
  open,
  onOpenChange,
  session,
  defaultDate,
  defaultMinutes = 45,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session?: StudySession | null;
  defaultDate?: Date | null;
  defaultMinutes?: number;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const save = useDbMutation(
    (sb, input: SessionInput) => (session ? updateSession(sb, session.id, input) : createSession(sb, input)),
    { invalidate: [qk.sessions], success: session ? "Session updated" : "Session added", onSuccess: () => onOpenChange(false) }
  );
  const remove = useDbMutation((sb, id: string) => deleteSession(sb, id), {
    invalidate: [qk.sessions],
    success: "Session deleted",
    onSuccess: () => onOpenChange(false),
  });

  const start = session ? new Date(session.start_time) : defaultStart(defaultDate);
  const end = session ? new Date(session.end_time) : new Date(start.getTime() + defaultMinutes * 60_000);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(studySessionSchema, {
      title: fd.get("title"),
      description: fd.get("description"),
      subject_id: fd.get("subject_id"),
      start_time: fd.get("start_time"),
      end_time: fd.get("end_time"),
    });
    if (!v.ok) return setErrors(v.errors);
    save.mutate({
      ...v.data,
      start_time: fromLocalInput(v.data.start_time),
      end_time: fromLocalInput(v.data.end_time),
      ...(session ? { status: fd.get("status") as SessionStatus } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session ? "Edit study session" : "New study session"}</DialogTitle>
        </DialogHeader>
        <form key={session?.id ?? String(start.getTime())} onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Title" htmlFor="ss-title" error={errors.title}>
            <Input id="ss-title" name="title" defaultValue={session?.title ?? ""} placeholder="e.g. Revise thermodynamics" autoFocus maxLength={160} aria-invalid={!!errors.title} />
          </Field>
          <Field label="Subject" htmlFor="ss-subject">
            <SubjectSelect id="ss-subject" name="subject_id" defaultValue={session?.subject_id ?? ""} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="ss-start" error={errors.start_time}>
              <Input id="ss-start" name="start_time" type="datetime-local" defaultValue={toLocalInput(start)} aria-invalid={!!errors.start_time} />
            </Field>
            <Field label="Ends" htmlFor="ss-end" error={errors.end_time}>
              <Input id="ss-end" name="end_time" type="datetime-local" defaultValue={toLocalInput(end)} aria-invalid={!!errors.end_time} />
            </Field>
          </div>
          {session && (
            <Field label="Status" htmlFor="ss-status">
              <NativeSelect id="ss-status" name="status" defaultValue={session.status}>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
              </NativeSelect>
            </Field>
          )}
          <Field label="Description" htmlFor="ss-desc" optional error={errors.description}>
            <Textarea id="ss-desc" name="description" defaultValue={session?.description ?? ""} rows={2} maxLength={2000} />
          </Field>
          <DialogFooter className="sm:justify-between">
            {session ? (
              <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive-soft" loading={remove.isPending} onClick={() => remove.mutate(session.id)}>
                Delete
              </Button>
            ) : <span className="hidden sm:block" />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>{session ? "Save changes" : "Add session"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
