"use client";
import * as React from "react";
import { NativeSelect } from "@/components/ui/input";
import { useSubjects } from "@/hooks/use-data";
import { colorFor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import type { Subject } from "@/types/database";

export function SubjectDot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", colorFor(color).dot, className)} aria-hidden />;
}

export function SubjectTag({ subject, className }: { subject?: Pick<Subject, "name" | "color"> | null; className?: string }) {
  if (!subject) return null;
  const c = colorFor(subject.color);
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium", c.soft, c.text, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", c.dot)} />
      <span className="truncate">{subject.name}</span>
    </span>
  );
}

/** Subject picker backed by the user's real subjects. */
export const SubjectSelect = React.forwardRef<
  HTMLSelectElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & { allowNone?: boolean; noneLabel?: string }
>(({ allowNone = true, noneLabel = "No subject", ...props }, ref) => {
  const { data, isLoading } = useSubjects();
  return (
    <NativeSelect ref={ref} disabled={isLoading || props.disabled} {...props}>
      {allowNone && <option value="">{isLoading ? "Loading…" : noneLabel}</option>}
      {(data ?? []).map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </NativeSelect>
  );
});
SubjectSelect.displayName = "SubjectSelect";
