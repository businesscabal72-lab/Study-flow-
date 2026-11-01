"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SubjectSelect } from "@/components/common/subject";
import { useDbMutation } from "@/hooks/use-mutation";
import { createAssignment, updateAssignment, type AssignmentInput } from "@/lib/data/planner";
import { qk } from "@/lib/data/core";
import { assignmentSchema, validate, type FieldErrors } from "@/lib/validations";
import { ASSIGNMENT_STATUS_LABEL, PRIORITY_LABEL, fromLocalInput, toLocalInput } from "@/lib/utils/format";
import { ASSIGNMENT_STATUSES, PRIORITIES, type Assignment } from "@/types/database";

function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d);
}

export function AssignmentDialog({
  open,
  onOpenChange,
  assignment,
  defaultSubjectId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignment?: Assignment | null;
  defaultSubjectId?: string | null;
  defaultDate?: Date | null;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const save = useDbMutation(
    (sb, input: AssignmentInput) => (assignment ? updateAssignment(sb, assignment.id, input) : createAssignment(sb, input)),
    { invalidate: [qk.assignments, qk.subjects], success: assignment ? "Assignment updated" : "Assignment created", onSuccess: () => onOpenChange(false) }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(assignmentSchema, {
      title: fd.get("title"),
      description: fd.get("description"),
      subject_id: fd.get("subject_id"),
      due_date: fd.get("due_date"),
      priority: fd.get("priority"),
      status: fd.get("status"),
    });
    if (!v.ok) return setErrors(v.errors);
    save.mutate({ ...v.data, due_date: fromLocalInput(v.data.due_date) });
  }

  const dueDefault = assignment
    ? toLocalInput(assignment.due_date)
    : defaultDate
      ? toLocalInput(new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate(), 23, 59))
      : defaultDue();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{assignment ? "Edit assignment" : "New assignment"}</DialogTitle>
        </DialogHeader>
        <form key={assignment?.id ?? "new"} onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Title" htmlFor="a-title" error={errors.title}>
            <Input id="a-title" name="title" defaultValue={assignment?.title} autoFocus maxLength={160} aria-invalid={!!errors.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject" htmlFor="a-subject" error={errors.subject_id}>
              <SubjectSelect id="a-subject" name="subject_id" defaultValue={assignment?.subject_id ?? defaultSubjectId ?? ""} />
            </Field>
            <Field label="Due" htmlFor="a-due" error={errors.due_date}>
              <Input id="a-due" name="due_date" type="datetime-local" defaultValue={dueDefault} aria-invalid={!!errors.due_date} />
            </Field>
            <Field label="Priority" htmlFor="a-priority">
              <NativeSelect id="a-priority" name="priority" defaultValue={assignment?.priority ?? "medium"}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Status" htmlFor="a-status">
              <NativeSelect id="a-status" name="status" defaultValue={assignment?.status ?? "not_started"}>
                {ASSIGNMENT_STATUSES.map((s) => <option key={s} value={s}>{ASSIGNMENT_STATUS_LABEL[s]}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Description" htmlFor="a-desc" optional error={errors.description}>
            <Textarea id="a-desc" name="description" defaultValue={assignment?.description ?? ""} rows={3} maxLength={4000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{assignment ? "Save changes" : "Create assignment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
