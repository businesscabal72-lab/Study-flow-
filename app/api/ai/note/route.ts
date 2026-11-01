import { guardAI, jsonError, parseBody, streamText } from "@/lib/ai/guard";
import { loadNotesForAI } from "@/lib/ai/notes-context";
import { NOTE_ACTION_PROMPTS, notesBlock, TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { noteActionSchema } from "@/lib/validations/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await parseBody(req, (v) => noteActionSchema.safeParse(v));
  if ("error" in body) return body.error;

  const g = await guardAI(`note_${body.data.action}`);
  if (g instanceof Response) return g;

  const { notes, truncated } = await loadNotesForAI(g.supabase, [body.data.noteId]).catch(() => ({ notes: [], truncated: false }));
  if (notes.length === 0) return jsonError("Note not found.", 404);
  if (notes[0].text.length < 20) return jsonError("This note doesn't have enough text yet. Write a bit more, then try again.", 422);

  const prompt = `${NOTE_ACTION_PROMPTS[body.data.action]}${truncated ? "\n(The note was long and has been shortened; say so briefly at the end.)" : ""}${notesBlock(notes)}`;
  return streamText(g.ai.stream({ system: TUTOR_SYSTEM, messages: [{ role: "user", content: prompt }], temperature: 0.4, maxOutputTokens: 2048 }));
}
