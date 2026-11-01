"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { SubjectSelect } from "@/components/common/subject";
import { useDbMutation } from "@/hooks/use-mutation";
import { createSessions } from "@/lib/data/planner";
import { qk } from "@/lib/data/core";
import { fromLocalInput, toLocalInput } from "@/lib/utils/format";
import type { Suggestion } from "@/lib/logic/scheduler";

interface Row {
  key: string;
  include: boolean;
  title: string;
  subjectId: string;
  start: string; // datetime-local
  end: string;
  reason: string;
}

/**
 * Shows generated study blocks as editable rows. Nothing is saved until the
 * student reviews and confirms.
 */
export function PlanReviewDialog({
  open,
  onOpenChange,
  title,
  description,
  suggestions,
  emptyMessage,
  footerNote,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  suggestions: Suggestion[];
  emptyMessage: string;
  footerNote?: React.ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setRows(
        suggestions.map((s) => ({
          key: s.key,
          include: true,
          title: s.title.slice(0, 160),
          subjectId: s.subjectId ?? "",
          start: toLocalInput(s.start),
          end: toLocalInput(s.end),
          reason: s.reason,
        }))
      );
    }
  }, [open, suggestions]);

  const save = useDbMutation(
    (sb, list: Row[]) =>
      createSessions(
        sb,
        list.map((r) => ({ title: r.title.trim(), subject_id: r.subjectId || null, start_time: fromLocalInput(r.start), end_time: fromLocalInput(r.end), description: r.reason }))
      ),
    { invalidate: [qk.sessions], success: (r) => `${r.length} session${r.length === 1 ? "" : "s"} added to your schedule`, onSuccess: () => onOpenChange(false) }
  );

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include);

  const submit = () => {
    for (const r of chosen) {
      if (!r.title.trim()) return setError("Every selected session needs a title.");
      const s = new Date(r.start), e = new Date(r.end);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return setError("Check the dates on the selected sessions.");
      if (e <= s) return setError(`“${r.title}” ends before it starts.`);
    }
    setError(null);
    save.mutate(chosen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <CalendarCheck className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.key} className={`rounded-lg border border-border p-3 ${r.include ? "" : "opacity-50"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-2" checked={r.include} label={`Include ${r.title}`} onCheckedChange={(v) => update(r.key, { include: v })} />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                      <Input value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} aria-label="Session title" maxLength={160} className="h-8" />
                      <SubjectSelect value={r.subjectId} onChange={(e) => update(r.key, { subjectId: e.target.value })} aria-label="Subject" className="h-8 text-[13px]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="datetime-local" value={r.start} onChange={(e) => update(r.key, { start: e.target.value })} aria-label="Start" className="h-8 text-[13px]" />
                      <Input type="datetime-local" value={r.end} onChange={(e) => update(r.key, { end: e.target.value })} aria-label="End" className="h-8 text-[13px]" />
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.start), "EEE MMM d")} · {r.reason}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {footerNote}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={chosen.length === 0} loading={save.isPending}>Add {chosen.length} to schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
