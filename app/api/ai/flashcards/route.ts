import { NextResponse } from "next/server";
import { guardAI, jsonError, parseBody, providerErrorResponse } from "@/lib/ai/guard";
import { loadNotesForAI } from "@/lib/ai/notes-context";
import { FLASHCARD_INSTRUCTIONS, notesBlock, TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { flashcardRequestSchema, flashcardResponseSchema } from "@/lib/validations/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractJSON(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("not json");
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, (v) => flashcardRequestSchema.safeParse(v));
  if ("error" in body) return body.error;

  const g = await guardAI("flashcards");
  if (g instanceof Response) return g;

  const { notes } = await loadNotesForAI(g.supabase, [body.data.noteId]).catch(() => ({ notes: [] }));
  if (notes.length === 0) return jsonError("Note not found.", 404);
  if (notes[0].text.length < 40) return jsonError("This note is too short to make flashcards from. Add more content first.", 422);

  let raw: string;
  try {
    raw = await g.ai.generate({
      system: TUTOR_SYSTEM,
      messages: [{ role: "user", content: FLASHCARD_INSTRUCTIONS(body.data.count) + notesBlock(notes) }],
      json: true,
      temperature: 0.3,
      maxOutputTokens: 3000,
    });
  } catch (e) {
    return providerErrorResponse(e);
  }

  let parsed;
  try {
    parsed = flashcardResponseSchema.safeParse(extractJSON(raw));
  } catch {
    return jsonError("The AI response wasn't in the expected format. Please try again.", 502);
  }
  if (!parsed.success) return jsonError("The AI response wasn't in the expected format. Please try again.", 502);
  return NextResponse.json({ cards: parsed.data.cards.slice(0, 15) }, { headers: { "Cache-Control": "no-store" } });
}
