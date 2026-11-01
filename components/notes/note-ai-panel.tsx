"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { Markdown } from "@/components/ai/markdown";
import { postJSON, postStream } from "@/lib/ai/client";
import { useDbMutation } from "@/hooks/use-mutation";
import { createFlashcards } from "@/lib/data/practice";
import { qk } from "@/lib/data/core";
import { errorMessage } from "@/lib/utils/format";

export type NoteAIAction = "summarize" | "explain" | "key_points" | "flashcards" | "questions";

const TITLES: Record<NoteAIAction, string> = {
  summarize: "Summary",
  explain: "Difficult concepts, explained",
  key_points: "Key points",
  flashcards: "Generated flashcards",
  questions: "Practice questions",
};

interface Card {
  question: string;
  answer: string;
}

export function NoteAIPanel({ noteId, subjectId, action, onClose }: { noteId: string; subjectId: string | null; action: NoteAIAction | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const saveCards = useDbMutation(
    (sb, list: Card[]) => createFlashcards(sb, list.map((c) => ({ ...c, subject_id: subjectId, note_id: noteId }))),
    { invalidate: [qk.flashcards], success: (r) => `${r.length} flashcard${r.length === 1 ? "" : "s"} saved`, onSuccess: () => onClose() }
  );

  const run = async (a: NoteAIAction) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setCards([]);
    setError(null);
    setLoading(true);
    try {
      if (a === "flashcards") {
        const res = await postJSON<{ cards: Card[] }>("/api/ai/flashcards", { noteId }, ctrl.signal);
        setCards(res.cards);
        setSelected(new Set(res.cards.map((_, i) => i)));
      } else {
        await postStream("/api/ai/note", { noteId, action: a }, setText, ctrl.signal);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(errorMessage(e));
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  };

  useEffect(() => {
    if (action) run(action);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, noteId]);

  return (
    <Dialog open={!!action} onOpenChange={(v) => { if (!v) { abort.current?.abort(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />{action ? TITLES[action] : ""}</DialogTitle>
          <DialogDescription>Generated from the saved text of this note. AI can make mistakes — check against your materials.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[55dvh] min-h-24 overflow-y-auto">
          {error ? (
            <div role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</div>
          ) : action === "flashcards" ? (
            loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (
              <ul className="space-y-2">
                {cards.map((c, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-border p-3">
                    <Checkbox
                      checked={selected.has(i)}
                      label={`Include card ${i + 1}`}
                      className="mt-0.5"
                      onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(i); else n.delete(i); return n; })}
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{c.question}</p>
                      <p className="mt-1 text-muted-foreground">{c.answer}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : text ? (
            <Markdown text={text} />
          ) : loading ? (
            <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4" /><Skeleton className="h-4 w-5/6" /></div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" disabled={loading || !action} onClick={() => action && run(action)}><RefreshCw /> Regenerate</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {action !== "flashcards" && (
              <>
                <Button variant="outline" size="sm" asChild><Link href={`/ai?note=${noteId}`}>Ask follow-up in chat</Link></Button>
                <Button
                  size="sm"
                  disabled={!text || loading}
                  onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Couldn't copy"))}
                >
                  <Copy /> Copy
                </Button>
              </>
            )}
            {action === "flashcards" && (
              <Button
                size="sm"
                disabled={loading || selected.size === 0}
                loading={saveCards.isPending}
                onClick={() => saveCards.mutate(cards.filter((_, i) => selected.has(i)))}
              >
                Save {selected.size} card{selected.size === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
