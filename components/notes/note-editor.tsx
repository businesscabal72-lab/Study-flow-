"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, Loader2, MoreHorizontal, Pin, PinOff, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/common/page";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SubjectSelect } from "@/components/common/subject";
import { EditorToolbar } from "./editor-toolbar";
import { Attachments } from "./attachments";
import { NoteAIPanel, type NoteAIAction } from "./note-ai-panel";
import { useNote } from "@/hooks/use-data";
import { useAutosave } from "@/hooks/use-autosave";
import { useDbMutation } from "@/hooks/use-mutation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { deleteNote, updateNote, type NotePatch } from "@/lib/data/notes";
import { qk } from "@/lib/data/core";
import { fmtAgo } from "@/lib/utils/format";
import type { Note, NoteSummary } from "@/types/database";

const AI_ACTIONS: { id: NoteAIAction; label: string }[] = [
  { id: "summarize", label: "Summarize note" },
  { id: "explain", label: "Explain difficult concepts" },
  { id: "key_points", label: "Extract key points" },
  { id: "flashcards", label: "Generate flashcards" },
  { id: "questions", label: "Generate practice questions" },
];

export function NoteEditor({ noteId, onBack, onDeleted }: { noteId: string; onBack: () => void; onDeleted: () => void }) {
  const note = useNote(noteId);
  if (note.isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-4 w-40" /><Skeleton className="h-64" /></div>;
  if (note.error || !note.data) return <div className="p-6"><ErrorState error={note.error ?? new Error("Note not found")} onRetry={() => note.refetch()} /></div>;
  return <Editor note={note.data} onBack={onBack} onDeleted={onDeleted} />;
}

function Editor({ note, onBack, onDeleted }: { note: Note; onBack: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [pinned, setPinned] = useState(note.is_pinned);
  const [subjectId, setSubjectId] = useState(note.subject_id ?? "");
  const [updatedAt, setUpdatedAt] = useState(note.updated_at);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiAction, setAiAction] = useState<NoteAIAction | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const autosave = useAutosave<NotePatch>(async (patch) => {
    const saved = await updateNote(getSupabaseBrowser(), note.id, patch);
    setUpdatedAt(saved.updated_at);
    qc.setQueryData(qk.note(note.id), saved);
    // Update the sidebar list in place (no refetch flicker while typing).
    qc.setQueryData<NoteSummary[]>(qk.notes, (list) => {
      if (!list) return list;
      const { content: _c, ...summary } = saved;
      void _c;
      const next = list.map((n) => (n.id === saved.id ? summary : n));
      return next.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || +new Date(b.updated_at) - +new Date(a.updated_at));
    });
    if ("subject_id" in patch) qc.invalidateQueries({ queryKey: qk.subjects });
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "Start writing… Use the toolbar for headings, lists, checklists, tables and code." }),
    ],
    content: isEmptyDoc(note.content) ? "" : (note.content as object),
    editorProps: { attributes: { class: "tiptap prose prose-sm max-w-none dark:prose-invert prose-headings:tracking-tight prose-p:my-0", "aria-label": "Note content" } },
    onUpdate: ({ editor: e }) => autosave.queue({ content: e.getJSON(), content_text: e.getText({ blockSeparator: "\n" }).slice(0, 200_000) }),
  });

  // Grow the title field with its content.
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  const del = useDbMutation((sb) => deleteNote(sb, note.id), {
    invalidate: [qk.notes, qk.subjects],
    success: "Note deleted",
    onSuccess: () => onDeleted(),
  });

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").slice(0, 30);
    setTagDraft("");
    if (!t || tags.includes(t) || tags.length >= 20) return;
    const next = [...tags, t];
    setTags(next);
    autosave.queue({ tags: next });
  };

  const openAI = async (a: NoteAIAction) => {
    await autosave.flush(); // the AI reads the saved note, so save first
    setAiAction(a);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Back to notes"><ArrowLeft /></Button>
        <SaveIndicator status={autosave.status} error={autosave.error} onRetry={() => autosave.flush()} updatedAt={updatedAt} />
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="sm"><Sparkles /> <span className="hidden sm:inline">AI</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Use this note with AI</DropdownMenuLabel>
              {AI_ACTIONS.map((a) => <DropdownMenuItem key={a.id} onSelect={() => openAI(a.id)}>{a.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={pinned ? "Unpin note" : "Pin note"}
            onClick={() => { setPinned(!pinned); autosave.queue({ is_pinned: !pinned }); }}
          >
            {pinned ? <PinOff /> : <Pin />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More note actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => { setPinned(!pinned); autosave.queue({ is_pinned: !pinned }); }}>{pinned ? <PinOff /> : <Pin />}{pinned ? "Unpin" : "Pin to top"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}><Trash2 /> Delete note</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-10">
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            maxLength={200}
            placeholder="Untitled"
            aria-label="Note title"
            onChange={(e) => {
              const v = e.target.value.replace(/\n/g, " ");
              setTitle(v);
              autosave.queue({ title: v.trim() || "Untitled" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
            className="w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            <SubjectSelect
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); autosave.queue({ subject_id: e.target.value || null }); }}
              aria-label="Subject"
              className="h-7 w-auto min-w-36 border-transparent bg-muted text-xs shadow-none"
            />
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-lavender-soft px-1.5 py-0.5 text-xs text-lavender">
                #{t}
                <button onClick={() => { const next = tags.filter((x) => x !== t); setTags(next); autosave.queue({ tags: next }); }} aria-label={`Remove tag ${t}`}><X className="size-3" /></button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
              onBlur={addTag}
              placeholder="+ Add tag"
              aria-label="Add tag"
              maxLength={30}
              className="h-7 w-24 rounded-md bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground focus:bg-muted"
            />
          </div>

          {editor && (
            <div className="sticky top-0 z-10 -mx-2 mt-5 rounded-lg border border-border bg-background/95 backdrop-blur">
              <EditorToolbar editor={editor} />
            </div>
          )}
          <div className="mt-6">
            {editor ? <EditorContent editor={editor} /> : <Skeleton className="h-40" />}
          </div>
          <Attachments noteId={note.id} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this note?"
        description="The note and its attached PDFs will be permanently deleted. Flashcards made from it are kept."
        loading={del.isPending}
        onConfirm={() => { autosave.cancel(); del.mutate(undefined); }}
      />
      <NoteAIPanel
        noteId={note.id}
        subjectId={subjectId || null}
        action={aiAction}
        onClose={() => setAiAction(null)}
      />
    </div>
  );
}

function isEmptyDoc(c: unknown): boolean {
  if (!c || typeof c !== "object") return true;
  const content = (c as { content?: unknown[] }).content;
  return !Array.isArray(content) || content.length === 0;
}

function SaveIndicator({ status, error, onRetry, updatedAt }: { status: string; error: string | null; onRetry: () => void; updatedAt: string }) {
  if (status === "error")
    return (
      <button onClick={onRetry} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive-soft" title={error ?? undefined}>
        <AlertCircle className="size-3.5" /> Not saved — retry
      </button>
    );
  if (status === "saving" || status === "pending")
    return <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>;
  return <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground"><Check className="size-3.5 text-success" /> Saved · {fmtAgo(updatedAt)}</span>;
}
