"use client";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, History, Layers, MoreHorizontal, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Progress, Skeleton } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SubjectSelect, SubjectTag } from "@/components/common/subject";
import { FlashcardDialog } from "./flashcard-dialog";
import { NoteAIPanel } from "@/components/notes/note-ai-panel";
import { useFlashcards, useNotes, useReviews, useSubjectMap } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { deleteFlashcard, reviewFlashcard } from "@/lib/data/practice";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isDue, previewInterval } from "@/lib/logic/srs";
import { errorMessage, fmtAgo, fmtRelativeDay } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Flashcard, Rating } from "@/types/database";

export function FlashcardsView() {
  const cards = useFlashcards();
  const { map: subjects } = useSubjectMap();
  const [subject, setSubject] = useState("");
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Flashcard | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genNote, setGenNote] = useState<{ id: string; subjectId: string | null } | null>(null);
  const [session, setSession] = useState<Flashcard[] | null>(null);

  const del = useDbMutation((sb, id: string) => deleteFlashcard(sb, id), { invalidate: [qk.flashcards], success: "Card deleted", onSuccess: () => setDeleting(null) });

  const filtered = (cards.data ?? []).filter((c) => !subject || c.subject_id === subject);
  const due = filtered.filter((c) => isDue(c.next_review_at));

  if (session) return <ReviewSession queue={session} onExit={() => setSession(null)} subjects={subjects} />;

  return (
    <div>
      <PageHeader
        title="Flashcards"
        description="Spaced repetition: cards you find difficult come back sooner, easy ones later."
        actions={
          <>
            <Button variant="outline" onClick={() => setGenerateOpen(true)}><Sparkles /> Generate from note</Button>
            <Button onClick={() => setCreating(true)}><Plus /> New card</Button>
          </>
        }
      />
      <div className="mb-4 max-w-xs">
        <SubjectSelect value={subject} onChange={(e) => setSubject(e.target.value)} noneLabel="All subjects" aria-label="Filter by subject" />
      </div>
      {cards.isLoading ? <Skeleton className="h-64" /> : cards.error ? <ErrorState error={cards.error} onRetry={() => cards.refetch()} /> : (cards.data ?? []).length === 0 ? (
        <EmptyState icon={Layers} title="No flashcards yet" description="Create cards by hand or generate them from one of your notes." action={<div className="flex gap-2"><Button variant="outline" onClick={() => setGenerateOpen(true)}><Sparkles /> Generate</Button><Button onClick={() => setCreating(true)}><Plus /> New card</Button></div>} />
      ) : (
        <Tabs defaultValue="review">
          <TabsList>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="all">All cards ({filtered.length})</TabsTrigger>
            <TabsTrigger value="history"><History /> History</TabsTrigger>
          </TabsList>
          <TabsContent value="review">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                {due.length > 0 ? (
                  <>
                    <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Layers className="size-6" /></div>
                    <div>
                      <p className="text-3xl font-semibold tabular-nums">{due.length}</p>
                      <p className="text-sm text-muted-foreground">card{due.length === 1 ? "" : "s"} due for review</p>
                    </div>
                    <Button size="lg" onClick={() => setSession([...due].sort((a, b) => +new Date(a.next_review_at) - +new Date(b.next_review_at)))}>Start review</Button>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-8 text-success" />
                    <div>
                      <p className="font-medium">All caught up</p>
                      <p className="text-sm text-muted-foreground">
                        {filtered.length ? `Next review ${fmtRelativeDay([...filtered].sort((a, b) => +new Date(a.next_review_at) - +new Date(b.next_review_at))[0].next_review_at).toLowerCase()}.` : "No cards in this subject."}
                      </p>
                    </div>
                    {filtered.length > 0 && <Button variant="outline" onClick={() => setSession([...filtered].sort(() => Math.random() - 0.5).slice(0, 20))}>Practice anyway</Button>}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="all">
            {filtered.length === 0 ? <EmptyState compact icon={Layers} title="No cards in this subject" /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                  <Card key={c.id} className="flex flex-col p-4">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm font-medium">{c.question}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Card actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setEditing(c)}><Pencil /> Edit</DropdownMenuItem>
                          <DropdownMenuItem destructive onSelect={() => setDeleting(c)}><Trash2 /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">{c.answer}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      <SubjectTag subject={c.subject_id ? subjects.get(c.subject_id) : null} />
                      {c.difficulty && <Badge variant={c.difficulty === "easy" ? "sage" : c.difficulty === "medium" ? "sand" : "destructive"}>{c.difficulty}</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">{isDue(c.next_review_at) ? "Due now" : `Due ${fmtRelativeDay(c.next_review_at).toLowerCase()}`}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="history"><ReviewHistory cards={cards.data ?? []} /></TabsContent>
        </Tabs>
      )}

      <FlashcardDialog open={creating || !!editing} onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }} card={editing} defaultSubjectId={subject} />
      <ConfirmDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)} title="Delete card?" description="Its review history will also be deleted." loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
      <PickNoteDialog open={generateOpen} onOpenChange={setGenerateOpen} onPick={(n) => { setGenerateOpen(false); setGenNote(n); }} />
      <NoteAIPanel noteId={genNote?.id ?? ""} subjectId={genNote?.subjectId ?? null} action={genNote ? "flashcards" : null} onClose={() => setGenNote(null)} />
    </div>
  );
}

function PickNoteDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (n: { id: string; subjectId: string | null }) => void }) {
  const notes = useNotes();
  const [id, setId] = useState("");
  const usable = (notes.data ?? []).filter((n) => n.content_text.trim().length >= 40);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate flashcards</DialogTitle>
          <DialogDescription>Pick a note. The AI reads its saved text and drafts cards for you to review before saving.</DialogDescription>
        </DialogHeader>
        {notes.isLoading ? <Skeleton className="h-9" /> : usable.length === 0 ? (
          <p className="text-sm text-muted-foreground">You need a note with some content first (at least a couple of sentences).</p>
        ) : (
          <NativeSelect value={id} onChange={(e) => setId(e.target.value)} aria-label="Note">
            <option value="">Choose a note…</option>
            {usable.map((n) => <option key={n.id} value={n.id}>{n.title || "Untitled"}</option>)}
          </NativeSelect>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!id} onClick={() => { const n = usable.find((x) => x.id === id); if (n) onPick({ id: n.id, subjectId: n.subject_id }); }}><Sparkles /> Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewSession({ queue: initial, onExit, subjects }: { queue: Flashcard[]; onExit: () => void; subjects: Map<string, { name: string; color: import("@/types/database").SubjectColor }> }) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState(initial);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = queue[index];
  const total = queue.length;

  const intervals = useMemo(() => (card ? { easy: previewInterval(card, "easy"), medium: previewInterval(card, "medium"), difficult: previewInterval(card, "difficult") } : null), [card]);

  async function rate(r: Rating) {
    if (!card || busy) return;
    setBusy(true);
    try {
      const updated = await reviewFlashcard(getSupabaseBrowser(), card, r);
      setReviewed((n) => n + 1);
      // Difficult cards come back at the end of this session.
      if (r === "difficult") setQueue((q) => [...q, updated]);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const exit = () => {
    qc.invalidateQueries({ queryKey: qk.flashcards });
    qc.invalidateQueries({ queryKey: qk.reviews });
    onExit();
  };

  if (!card) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-xl font-semibold">Session complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">You reviewed {reviewed} card{reviewed === 1 ? "" : "s"}. Upcoming reviews are scheduled automatically.</p>
        <Button className="mt-6" onClick={exit}>Done</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={exit}>End session</Button>
        <Progress value={(index / total) * 100} className="flex-1" />
        <span className="text-xs tabular-nums text-muted-foreground">{index + 1}/{total}</span>
      </div>
      <div className="flip-scene">
        <button
          onClick={() => setFlipped((f) => !f)}
          className={cn("flip-card relative block h-80 w-full text-left", flipped && "is-flipped")}
          aria-label={flipped ? "Show question" : "Show answer"}
        >
          <div className="flip-face absolute inset-0 flex flex-col rounded-2xl border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</span>
              <SubjectTag subject={card.subject_id ? subjects.get(card.subject_id) : null} />
            </div>
            <p className="m-auto whitespace-pre-line text-center text-lg font-medium">{card.question}</p>
            <p className="text-center text-xs text-muted-foreground">Tap to reveal the answer</p>
          </div>
          <div className="flip-face flip-back absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-primary/30 bg-card p-6 shadow-float">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">Answer</span>
            <p className="m-auto whitespace-pre-line text-center text-base">{card.answer}</p>
          </div>
        </button>
      </div>
      {flipped && intervals ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(["difficult", "medium", "easy"] as Rating[]).map((r) => (
            <Button key={r} variant="outline" size="lg" disabled={busy} onClick={() => rate(r)} className={cn("h-auto flex-col gap-0.5 py-2.5", r === "difficult" && "hover:border-destructive/50 hover:bg-destructive-soft", r === "easy" && "hover:border-primary/50 hover:bg-primary-soft")}>
              <span className="capitalize">{r}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{intervals[r]}</span>
            </Button>
          ))}
        </div>
      ) : (
        <Button className="mt-5 w-full" size="lg" variant="secondary" onClick={() => setFlipped(true)}><RotateCcw /> Show answer</Button>
      )}
      <p className="mt-3 text-center text-xs text-muted-foreground">Last reviewed {card.last_reviewed_at ? fmtAgo(card.last_reviewed_at) : "never"}</p>
    </div>
  );
}

function ReviewHistory({ cards }: { cards: Flashcard[] }) {
  const since = useMemo(() => new Date(Date.now() - 30 * 86_400_000), []);
  const reviews = useReviews(since);
  const byCard = new Map(cards.map((c) => [c.id, c]));
  if (reviews.isLoading) return <Skeleton className="h-40" />;
  if (reviews.error) return <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />;
  const list = reviews.data ?? [];
  if (list.length === 0) return <EmptyState compact icon={History} title="No reviews in the last 30 days" />;
  const counts = { easy: 0, medium: 0, difficult: 0 };
  list.forEach((r) => counts[r.rating]++);
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader><CardTitle>Last 30 days</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-2xl font-semibold tabular-nums">{list.length} <span className="text-sm font-normal text-muted-foreground">reviews</span></p>
          <p className="flex justify-between"><span className="text-muted-foreground">Easy</span><span className="tabular-nums">{counts.easy}</span></p>
          <p className="flex justify-between"><span className="text-muted-foreground">Medium</span><span className="tabular-nums">{counts.medium}</span></p>
          <p className="flex justify-between"><span className="text-muted-foreground">Difficult</span><span className="tabular-nums">{counts.difficult}</span></p>
        </CardContent>
      </Card>
      <Card>
        <ul className="divide-y divide-border">
          {list.slice(0, 50).map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <Badge variant={r.rating === "easy" ? "sage" : r.rating === "medium" ? "sand" : "destructive"} className="w-16 justify-center">{r.rating}</Badge>
              <span className="min-w-0 flex-1 truncate">{byCard.get(r.flashcard_id)?.question ?? "Deleted card"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtAgo(r.reviewed_at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
