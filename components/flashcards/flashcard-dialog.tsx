"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SubjectSelect } from "@/components/common/subject";
import { useDbMutation } from "@/hooks/use-mutation";
import { createFlashcards, updateFlashcard, type FlashcardInput } from "@/lib/data/practice";
import { qk } from "@/lib/data/core";
import { flashcardSchema, validate, type FieldErrors } from "@/lib/validations";
import type { Flashcard } from "@/types/database";

export function FlashcardDialog({ open, onOpenChange, card, defaultSubjectId }: { open: boolean; onOpenChange: (v: boolean) => void; card?: Flashcard | null; defaultSubjectId?: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [keepOpen, setKeepOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => { if (open) setErrors({}); }, [open]);

  const save = useDbMutation(
    async (sb, input: FlashcardInput) => {
      if (card) await updateFlashcard(sb, card.id, input);
      else await createFlashcards(sb, [input]);
    },
    {
      invalidate: [qk.flashcards],
      success: card ? "Card updated" : "Card added",
      onSuccess: () => { if (keepOpen && !card) setFormKey((k) => k + 1); else onOpenChange(false); },
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(flashcardSchema, { question: fd.get("question"), answer: fd.get("answer"), subject_id: fd.get("subject_id") });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    save.mutate(v.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{card ? "Edit card" : "New flashcard"}</DialogTitle></DialogHeader>
        <form key={`${card?.id ?? "new"}-${formKey}`} onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Front" htmlFor="fc-q" error={errors.question}>
            <Textarea id="fc-q" name="question" defaultValue={card?.question} rows={3} maxLength={1000} autoFocus placeholder="Question or term" aria-invalid={!!errors.question} />
          </Field>
          <Field label="Back" htmlFor="fc-a" error={errors.answer}>
            <Textarea id="fc-a" name="answer" defaultValue={card?.answer} rows={4} maxLength={3000} placeholder="Answer or definition" aria-invalid={!!errors.answer} />
          </Field>
          <Field label="Subject" htmlFor="fc-s">
            <SubjectSelect id="fc-s" name="subject_id" defaultValue={card?.subject_id ?? defaultSubjectId ?? ""} />
          </Field>
          <DialogFooter className="sm:items-center">
            {!card && (
              <label className="mr-auto flex items-center gap-2 text-[13px] text-muted-foreground">
                <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="accent-[var(--primary)]" />
                Add another after saving
              </label>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{card ? "Save" : "Add card"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
