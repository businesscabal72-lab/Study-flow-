"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ClipboardList, GraduationCap, Library, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/misc";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface Result {
  id: string;
  label: string;
  type: "Note" | "Assignment" | "Subject" | "Exam";
  href: string;
}

const ICONS = { Note: BookOpen, Assignment: ClipboardList, Subject: Library, Exam: GraduationCap };

/** Searches the user's own records (RLS-scoped) by title. */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    // Strip characters that have meaning in PostgREST filter syntax.
    const term = q.trim().replace(/[,()*:]/g, " ").trim();
    if (term.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const sb = getSupabaseBrowser();
        const like = `%${term.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
        const [n, a, s, e] = await Promise.all([
          sb.from("notes").select("id,title").or(`title.ilike.${like},content_text.ilike.${like}`).limit(6),
          sb.from("assignments").select("id,title").ilike("title", like).limit(5),
          sb.from("subjects").select("id,name").ilike("name", like).limit(5),
          sb.from("exams").select("id,title").ilike("title", like).limit(4),
        ]);
        const err = n.error || a.error || s.error || e.error;
        if (err) throw err;
        if (cancelled) return;
        setResults([
          ...(s.data ?? []).map((x) => ({ id: x.id, label: x.name, type: "Subject" as const, href: `/subjects/${x.id}` })),
          ...(n.data ?? []).map((x) => ({ id: x.id, label: x.title || "Untitled", type: "Note" as const, href: `/notes?note=${x.id}` })),
          ...(a.data ?? []).map((x) => ({ id: x.id, label: x.title, type: "Assignment" as const, href: `/assignments?open=${x.id}` })),
          ...(e.data ?? []).map((x) => ({ id: x.id, label: x.title, type: "Exam" as const, href: `/exams?exam=${x.id}` })),
        ]);
        setActive(0);
        setError(null);
      } catch {
        if (!cancelled) setError("Search failed. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = (r: Result) => {
    onOpenChange(false);
    router.push(r.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="gap-0 p-0 sm:top-[18%] sm:translate-y-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && results[active]) go(results[active]);
            }}
            placeholder="Search notes, assignments, subjects, exams…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search query"
          />
          {loading && <Spinner />}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {error && <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>}
          {!error && q.trim().length < 2 && <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">Type at least 2 characters</p>}
          {!error && q.trim().length >= 2 && !loading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No matches for “{q.trim()}”</p>
          )}
          {results.map((r, i) => {
            const Icon = ICONS[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${i === active ? "bg-accent" : ""}`}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.type}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
