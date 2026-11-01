"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUp, BookOpen, History, MessageSquarePlus, Paperclip, RotateCcw, Sparkles, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Markdown } from "./markdown";
import { useConversations, useNotes } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { deleteConversation, listMessages } from "@/lib/data/practice";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { postStream } from "@/lib/ai/client";
import { errorMessage, fmtAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const MAX_CHARS = 4000;
const SUGGESTIONS = [
  { label: "Explain simply", prompt: "Explain photosynthesis in simple language, with an everyday analogy." },
  { label: "Practice questions", prompt: "Give me 5 practice questions on quadratic equations, with answers at the end." },
  { label: "Why was I wrong?", prompt: "I answered that the derivative of x² is x. Explain why that's incorrect and how to get it right." },
  { label: "Study plan", prompt: "Create a 2-week study plan to revise organic chemistry for 1 hour a day." },
  { label: "Revision notes", prompt: "Write concise revision notes on the causes of World War I." },
  { label: "Make flashcards", prompt: "Make 8 question-and-answer flashcards about the human digestive system." },
];

export function AIChat() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const conversations = useConversations();
  const notes = useNotes();
  const status = useQuery({ queryKey: ["ai-status"], queryFn: async () => (await (await fetch("/api/ai/status")).json()) as { configured: boolean }, staleTime: 300_000 });

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [lastFailed, setLastFailed] = useState<{ text: string; noteIds: string[] } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Preselect a note from ?note=<id> (e.g. "Ask follow-up in chat").
  useEffect(() => {
    const n = params.get("note");
    if (n) setAttached([n]);
  }, [params]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    const el = taRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }
  }, [input]);

  const del = useDbMutation((sb, id: string) => deleteConversation(sb, id), {
    invalidate: [qk.conversations],
    success: "Conversation deleted",
    onSuccess: (_r, id) => { setDeleting(null); if (id === conversationId) newChat(); },
  });

  function newChat() {
    abort.current?.abort();
    setConversationId(null);
    setMessages([]);
    setLastFailed(null);
    setHistoryOpen(false);
    taRef.current?.focus();
  }

  async function openConversation(id: string) {
    abort.current?.abort();
    setHistoryOpen(false);
    setConversationId(id);
    setLastFailed(null);
    setLoadingHistory(true);
    try {
      const rows = await listMessages(getSupabaseBrowser(), id);
      setMessages(rows.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    } catch (e) {
      setMessages([{ id: "err", role: "assistant", content: errorMessage(e), error: true }]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function send(text: string, noteIds: string[]) {
    const message = text.trim();
    if (!message || streaming) return;
    if (message.length > MAX_CHARS) return;
    setLastFailed(null);
    setInput("");
    const userMsg: UIMessage = { id: crypto.randomUUID(), role: "user", content: message };
    const botId = crypto.randomUUID();
    setMessages((m) => [...m.filter((x) => !x.error), userMsg, { id: botId, role: "assistant", content: "" }]);
    setStreaming(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await postStream(
        "/api/ai/chat",
        { conversationId, message, noteIds },
        (full) => setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: full } : x))),
        ctrl.signal,
        (res) => {
          const cid = res.headers.get("X-Conversation-Id");
          if (cid) setConversationId(cid);
        }
      );
      qc.invalidateQueries({ queryKey: qk.conversations });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((m) => m.map((x) => (x.id === botId && !x.content ? { ...x, content: "_Stopped._" } : x)));
      } else {
        setMessages((m) => [...m.filter((x) => !(x.id === botId && !x.content)), { id: crypto.randomUUID(), role: "assistant", content: errorMessage(e), error: true }]);
        setLastFailed({ text: message, noteIds });
      }
      qc.invalidateQueries({ queryKey: qk.conversations });
    } finally {
      setStreaming(false);
    }
  }

  const configured = status.data?.configured !== false;
  const noteMap = new Map((notes.data ?? []).map((n) => [n.id, n]));
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3"><Button variant="outline" className="w-full justify-start" onClick={newChat}><MessageSquarePlus /> New conversation</Button></div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.isLoading ? <div className="space-y-2 p-1">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : conversations.error ? (
          <p className="px-3 text-[13px] text-destructive">Couldn&apos;t load conversations.</p>
        ) : (conversations.data ?? []).length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-muted-foreground">No conversations yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.data!.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button onClick={() => openConversation(c.id)} className={cn("min-w-0 flex-1 rounded-md px-3 py-2 text-left", conversationId === c.id ? "bg-accent" : "hover:bg-accent/60")}>
                  <p className="truncate text-[13px]">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtAgo(c.updated_at)}</p>
                </button>
                <button onClick={() => setDeleting(c.id)} className="p-2 text-muted-foreground opacity-100 hover:text-destructive md:opacity-0 md:group-hover:opacity-100" aria-label={`Delete ${c.title}`}><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="-mx-4 -mt-5 -mb-28 flex h-[calc(100dvh-3.5rem-4rem)] sm:-mx-6 md:-mt-6 md:-mb-12 md:h-[calc(100dvh-3.5rem)]">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:block">{sidebar}</aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}><History /> History</Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={newChat}><MessageSquarePlus /> New</Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            {!configured && (
              <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium">AI isn&apos;t configured yet</p>
                  <p className="mt-0.5 text-muted-foreground">The server needs a <code className="rounded bg-muted px-1">GEMINI_API_KEY</code> environment variable. Everything else in StudyFlow works without it.</p>
                </div>
              </div>
            )}
            {loadingHistory ? (
              <div className="space-y-4"><Skeleton className="ml-auto h-10 w-2/3" /><Skeleton className="h-24" /></div>
            ) : messages.length === 0 ? (
              <div className="pt-6 text-center sm:pt-12">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="size-6" /></div>
                <h1 className="mt-4 text-xl font-semibold tracking-tight">What are we studying today?</h1>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Ask for explanations, practice questions or a study plan. Attach your notes to get answers grounded in what you&apos;ve written.</p>
                <div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.label} disabled={!configured} onClick={() => send(s.prompt, attached)} className="rounded-xl border border-border bg-card p-3 text-left shadow-soft transition-colors hover:bg-surface disabled:opacity-50">
                      <p className="text-[13px] font-medium">{s.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-2.5 text-sm">{m.content}</div>
                    </div>
                  ) : m.error ? (
                    <div key={m.id} role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <p>{m.content}</p>
                        {lastFailed && (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => send(lastFailed.text, lastFailed.noteIds)}><RotateCcw /> Try again</Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex gap-3">
                      <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Sparkles className="size-3.5" /></div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {m.content ? <Markdown text={m.content} /> : (
                          <div className="flex items-center gap-1 pt-2" aria-label="Thinking">
                            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 120}ms` }} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
                <p className="text-center text-[11px] text-muted-foreground">AI can make mistakes. Check important facts against your class materials.</p>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-border bg-background px-4 pb-4 pt-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {attached.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attached.map((id) => (
                  <span key={id} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md bg-lavender-soft px-2 py-1 text-xs text-lavender">
                    <BookOpen className="size-3 shrink-0" />
                    <span className="truncate">{noteMap.get(id)?.title || (notes.isLoading ? "Loading…" : "Note")}</span>
                    <button onClick={() => setAttached((a) => a.filter((x) => x !== id))} aria-label="Remove note"><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input, attached); }}
              className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-soft focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
            >
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach notes" onClick={() => setPickerOpen(true)} disabled={!configured}><Paperclip /></Button>
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input, attached); } }}
                rows={1}
                maxLength={MAX_CHARS}
                disabled={!configured}
                placeholder={configured ? "Ask anything about your studies…" : "AI is not configured"}
                aria-label="Message"
                className="max-h-[200px] min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              {streaming ? (
                <Button type="button" size="icon-sm" variant="secondary" onClick={() => abort.current?.abort()} aria-label="Stop generating"><Square className="size-3 fill-current" /></Button>
              ) : (
                <Button type="submit" size="icon-sm" disabled={!input.trim() || !configured} aria-label="Send"><ArrowUp /></Button>
              )}
            </form>
            {input.length > MAX_CHARS * 0.9 && <p className="mt-1 text-right text-[11px] text-muted-foreground">{input.length}/{MAX_CHARS}</p>}
          </div>
        </div>
      </section>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="h-[70dvh] p-0"><DialogTitle className="sr-only">Conversations</DialogTitle><div className="pt-10">{sidebar}</div></DialogContent>
      </Dialog>
      <NotePicker open={pickerOpen} onOpenChange={setPickerOpen} selected={attached} onChange={setAttached} />
      <ConfirmDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)} title="Delete conversation?" description="All messages in it will be permanently deleted." loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting)} />
    </div>
  );
}

function NotePicker({ open, onOpenChange, selected, onChange }: { open: boolean; onOpenChange: (v: boolean) => void; selected: string[]; onChange: (ids: string[]) => void }) {
  const notes = useNotes();
  const [q, setQ] = useState("");
  const list = (notes.data ?? []).filter((n) => !q.trim() || n.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use your notes as context</DialogTitle>
          <DialogDescription>Pick up to 3 notes. Only their text is sent — PDF attachments are not read.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {notes.isLoading ? <Skeleton className="h-10" /> : list.length === 0 ? <p className="py-4 text-center text-[13px] text-muted-foreground">No notes found.</p> : list.map((n) => {
            const on = selected.includes(n.id);
            const disabled = !on && selected.length >= 3;
            return (
              <button
                key={n.id}
                disabled={disabled}
                onClick={() => onChange(on ? selected.filter((x) => x !== n.id) : [...selected, n.id])}
                className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left disabled:opacity-40", on ? "border-primary bg-primary-soft/50" : "border-border hover:bg-accent")}
              >
                <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{n.title || "Untitled"}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.content_text ? `${n.content_text.length.toLocaleString()} characters` : "Empty"}</p>
                </div>
              </button>
            );
          })}
        </div>
        <Button onClick={() => onOpenChange(false)}>Done ({selected.length}/3)</Button>
      </DialogContent>
    </Dialog>
  );
}
