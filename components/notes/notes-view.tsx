"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Pin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/common/page";
import { SubjectDot, SubjectSelect } from "@/components/common/subject";
import { NoteEditor } from "./note-editor";
import { useNotes, useSubjectMap } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { createNote } from "@/lib/data/notes";
import { qk } from "@/lib/data/core";
import { fmtAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function NotesView() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("note");
  const notes = useNotes();
  const { map: subjects } = useSubjectMap();
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const create = useDbMutation((sb, subjectId: string | null) => createNote(sb, { subject_id: subjectId }), {
    invalidate: [qk.notes, qk.subjects],
    onSuccess: (n) => router.replace(`/notes?note=${n.id}`),
  });

  // Quick action from dashboard: /notes?new=1
  const createdFromParam = useRef(false);
  useEffect(() => {
    if (params.get("new") === "1" && !createdFromParam.current) {
      createdFromParam.current = true;
      create.mutate(null);
    }
  }, [params, create]);

  const allTags = useMemo(() => [...new Set((notes.data ?? []).flatMap((n) => n.tags))].sort(), [notes.data]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (notes.data ?? []).filter(
      (n) =>
        (!subjectFilter || n.subject_id === subjectFilter) &&
        (!tagFilter || n.tags.includes(tagFilter)) &&
        (!term || n.title.toLowerCase().includes(term) || n.content_text.toLowerCase().includes(term) || n.tags.some((t) => t.includes(term)))
    );
  }, [notes.data, q, subjectFilter, tagFilter]);

  const list = (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-8" aria-label="Search notes" />
          </div>
          <Button size="icon" onClick={() => create.mutate(subjectFilter || null)} loading={create.isPending} aria-label="New note">
            {!create.isPending && <Plus />}
          </Button>
        </div>
        <SubjectSelect value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} noneLabel="All subjects" aria-label="Filter by subject" className="h-8 text-[13px]" />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)} className={cn("rounded-md px-1.5 py-0.5 text-[11px]", tagFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {notes.isLoading ? (
          <div className="space-y-2 p-1">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : notes.error ? (
          <ErrorState error={notes.error} onRetry={() => notes.refetch()} className="m-1" />
        ) : filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">{(notes.data ?? []).length === 0 ? "No notes yet." : "No notes match your filters."}</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((n) => {
              const s = n.subject_id ? subjects.get(n.subject_id) : null;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => router.replace(`/notes?note=${n.id}`)}
                    className={cn("w-full rounded-lg px-3 py-2.5 text-left transition-colors", selected === n.id ? "bg-accent" : "hover:bg-accent/60")}
                  >
                    <div className="flex items-center gap-1.5">
                      {n.is_pinned && <Pin className="size-3 shrink-0 fill-current text-sand" />}
                      <p className="truncate text-sm font-medium">{n.title || "Untitled"}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.content_text || "Empty note"}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {s && <><SubjectDot color={s.color} /><span className="truncate">{s.name}</span><span>·</span></>}
                      <span className="shrink-0">{fmtAgo(n.updated_at)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="-mx-4 -mt-5 -mb-28 flex h-[calc(100dvh-3.5rem-4rem)] sm:-mx-6 md:-mt-6 md:-mb-12 md:h-[calc(100dvh-3.5rem)]">
      <aside className={cn("w-full shrink-0 border-r border-border bg-surface md:block md:w-72", selected ? "hidden" : "block")}>{list}</aside>
      <section className={cn("min-w-0 flex-1", selected ? "block" : "hidden md:block")}>
        {selected ? (
          <NoteEditor key={selected} noteId={selected} onBack={() => router.replace("/notes")} onDeleted={() => router.replace("/notes")} />
        ) : (
          <div className="grid h-full place-items-center p-6">
            <EmptyState
              icon={BookOpen}
              title={(notes.data ?? []).length === 0 ? "Write your first note" : "Select a note"}
              description="Notes autosave as you type and can be organized by subject and tags."
              action={<Button onClick={() => create.mutate(null)} loading={create.isPending}><Plus /> New note</Button>}
              className="border-0"
            />
          </div>
        )}
      </section>
    </div>
  );
}
