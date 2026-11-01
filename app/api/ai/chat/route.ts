import { guardAI, jsonError, parseBody, streamText } from "@/lib/ai/guard";
import { loadNotesForAI } from "@/lib/ai/notes-context";
import { notesBlock, TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { chatRequestSchema } from "@/lib/validations/ai";
import type { AIMessageInput } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

const HISTORY_LIMIT = 20;

export async function POST(req: Request) {
  const body = await parseBody(req, (v) => chatRequestSchema.safeParse(v));
  if ("error" in body) return body.error;
  const { message, noteIds } = body.data;

  const g = await guardAI("chat");
  if (g instanceof Response) return g;
  const { supabase, ai } = g;

  // Conversation: reuse (ownership enforced by RLS) or create.
  let conversationId = body.data.conversationId ?? null;
  if (conversationId) {
    const { data, error } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (error || !data) return jsonError("That conversation no longer exists.", 404);
  } else {
    const title = message.replace(/\s+/g, " ").slice(0, 60) + (message.length > 60 ? "…" : "");
    const { data, error } = await supabase.from("ai_conversations").insert({ title }).select("id").single();
    if (error || !data) return jsonError("Couldn't start a conversation.", 500);
    conversationId = data.id as string;
  }

  const { data: history, error: histErr } = await supabase
    .from("ai_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (histErr) return jsonError("Couldn't load the conversation.", 500);

  let notesCtx;
  try {
    notesCtx = await loadNotesForAI(supabase, noteIds);
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }

  const saveUser = await supabase.from("ai_messages").insert({ conversation_id: conversationId, role: "user", content: message });
  if (saveUser.error) return jsonError("Couldn't save your message.", 500);
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  let system = TUTOR_SYSTEM;
  if (notesCtx.notes.length) {
    system += `\n\nThe student attached ${notesCtx.notes.length} of their notes for this message.${notesCtx.truncated ? " Long notes were shortened to fit — mention this if the answer may depend on missing parts." : ""}${notesBlock(notesCtx.notes)}`;
  }
  if (notesCtx.missing > 0) system += `\n\n(${notesCtx.missing} selected note(s) could not be found and were not included — tell the student.)`;

  const messages: AIMessageInput[] = [...(history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string })), { role: "user", content: message }];

  const cid = conversationId;
  return streamText(
    ai.stream({ system, messages, temperature: 0.6, maxOutputTokens: 2048 }),
    async (full) => {
      if (full.trim()) await supabase.from("ai_messages").insert({ conversation_id: cid, role: "assistant", content: full.slice(0, 40000) });
    },
    { "X-Conversation-Id": cid }
  );
}
