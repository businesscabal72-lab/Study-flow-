import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_NOTE_CONTEXT_CHARS } from "@/lib/validations/ai";

/** Load notes the user owns (RLS-enforced) and trim to a safe context size. */
export async function loadNotesForAI(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return { notes: [] as { id: string; title: string; text: string }[], truncated: false, missing: 0 };
  const { data, error } = await supabase.from("notes").select("id,title,content_text").in("id", ids);
  if (error) throw new Error("Couldn't load the selected notes.");
  const per = Math.floor(MAX_NOTE_CONTEXT_CHARS / Math.max(1, data.length));
  let truncated = false;
  const notes = data.map((n) => {
    const text = (n.content_text ?? "").trim();
    if (text.length > per) truncated = true;
    return { id: n.id as string, title: (n.title as string) || "Untitled", text: text.slice(0, per) };
  });
  return { notes, truncated, missing: ids.length - data.length };
}
