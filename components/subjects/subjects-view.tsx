"use client";
import { useState } from "react";
import Link from "next/link";
import { Library, MoreHorizontal, Pencil, Plus, Trash2, User } from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress, Skeleton } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SubjectDialog } from "./subject-dialog";
import { useSubjects } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { deleteSubject } from "@/lib/data/subjects";
import { qk } from "@/lib/data/core";
import { chapterProgress } from "@/lib/logic/analytics";
import { colorFor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import type { Subject } from "@/types/database";

export function SubjectsView() {
  const { data, isLoading, error, refetch } = useSubjects();
  const [editing, setEditing] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const del = useDbMutation((sb, id: string) => deleteSubject(sb, id), {
    invalidate: [qk.subjects, qk.notes, qk.assignments, qk.chapters(), qk.exams],
    success: "Subject deleted",
    onSuccess: () => setDeleting(null),
  });

  return (
    <div>
      <PageHeader
        title="My Subjects"
        description="Everything you're studying, with chapters, notes and progress."
        actions={<Button onClick={() => setCreating(true)}><Plus /> New subject</Button>}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={Library} title="No subjects yet" description="Add the subjects you're studying to organize notes, assignments and exams." action={<Button onClick={() => setCreating(true)}><Plus /> Add a subject</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((s) => {
            const pct = chapterProgress(s.chapters.map((c) => c.status));
            const c = colorFor(s.color);
            const done = s.chapters.filter((x) => x.status === "completed").length;
            return (
              <Card key={s.id} className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-float">
                <div className={cn("h-1", c.dot)} />
                <Link href={`/subjects/${s.id}`} className="flex flex-1 flex-col p-5">
                  <p className="pr-8 text-base font-semibold tracking-tight">{s.name}</p>
                  {s.teacher_name && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><User className="size-3" />{s.teacher_name}</p>}
                  {s.description && <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">{s.description}</p>}
                  <div className="mt-auto pt-5">
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{done}/{s.chapters.length} chapters done</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <Progress value={pct} />
                    <p className="mt-2.5 text-xs text-muted-foreground">{s.notes[0]?.count ?? 0} notes</p>
                  </div>
                </Link>
                <div className="absolute right-3 top-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setEditing(s)}><Pencil /> Edit</DropdownMenuItem>
                      <DropdownMenuItem destructive onSelect={() => setDeleting(s)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <SubjectDialog open={creating || !!editing} onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }} subject={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Its chapters and resources will be deleted. Notes, assignments, exams and flashcards are kept but will no longer be linked to this subject."
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}
