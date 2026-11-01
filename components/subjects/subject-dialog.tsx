"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { useDbMutation } from "@/hooks/use-mutation";
import { createSubject, updateSubject } from "@/lib/data/subjects";
import { qk } from "@/lib/data/core";
import { subjectSchema, validate, type FieldErrors } from "@/lib/validations";
import { SUBJECT_COLORS, type Subject, type SubjectColor } from "@/types/database";
import { SUBJECT_COLOR_STYLES } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

export function SubjectDialog({
  open,
  onOpenChange,
  subject,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject?: Subject | null;
  onSaved?: (s: Subject) => void;
}) {
  const [color, setColor] = useState<SubjectColor>("sage");
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (open) {
      setColor(subject?.color ?? SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)]);
      setErrors({});
    }
  }, [open, subject]);

  const save = useDbMutation(
    (sb, input: { name: string; description?: string | null; teacher_name?: string | null; color: SubjectColor }) =>
      subject ? updateSubject(sb, subject.id, input) : createSubject(sb, input),
    {
      invalidate: [qk.subjects],
      success: subject ? "Subject updated" : "Subject added",
      onSuccess: (s) => {
        onOpenChange(false);
        onSaved?.(s);
      },
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(subjectSchema, { name: fd.get("name"), description: fd.get("description"), teacher_name: fd.get("teacher_name"), color });
    if (!v.ok) return setErrors(v.errors);
    save.mutate(v.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject ? "Edit subject" : "New subject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Name" htmlFor="s-name" error={errors.name}>
            <Input id="s-name" name="name" defaultValue={subject?.name} autoFocus maxLength={80} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Teacher" htmlFor="s-teacher" optional error={errors.teacher_name}>
            <Input id="s-teacher" name="teacher_name" defaultValue={subject?.teacher_name ?? ""} maxLength={80} />
          </Field>
          <Field label="Description" htmlFor="s-desc" optional error={errors.description}>
            <Textarea id="s-desc" name="description" defaultValue={subject?.description ?? ""} maxLength={500} rows={2} />
          </Field>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Subject color">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={SUBJECT_COLOR_STYLES[c].label}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-background transition",
                    SUBJECT_COLOR_STYLES[c].dot,
                    color === c ? "ring-2 ring-foreground/60" : "hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{subject ? "Save changes" : "Add subject"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
