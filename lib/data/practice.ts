import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIConversation, AIMessage, FocusSession, Flashcard, FlashcardReview, Profile, Rating } from "@/types/database";
import { scheduleReview } from "@/lib/logic/srs";
import { unwrap } from "./core";

// ── focus ──
export const listFocusSessions = async (sb: SupabaseClient, since?: Date) => {
  let q = sb.from("focus_sessions").select("*").order("completed_at", { ascending: false });
  if (since) q = q.gte("completed_at", since.toISOString());
  return unwrap<FocusSession[]>(await q);
};

/** Idempotent: the timer's sessionId is the client_id, so retries never double-count. */
export async function recordFocusSession(
  sb: SupabaseClient,
  input: { client_id: string; subject_id: string | null; duration_minutes: number; started_at: string; completed_at: string }
) {
  unwrap(await sb.from("focus_sessions").upsert(input, { onConflict: "client_id", ignoreDuplicates: true }));
}

// ── flashcards ──
export const listFlashcards = async (sb: SupabaseClient) =>
  unwrap<Flashcard[]>(await sb.from("flashcards").select("*").order("created_at", { ascending: false }));

export interface FlashcardInput {
  question: string;
  answer: string;
  subject_id?: string | null;
  note_id?: string | null;
}

export const createFlashcards = async (sb: SupabaseClient, inputs: FlashcardInput[]) =>
  unwrap<Flashcard[]>(await sb.from("flashcards").insert(inputs).select());

export const updateFlashcard = async (sb: SupabaseClient, id: string, input: Partial<FlashcardInput>) =>
  unwrap<Flashcard>(await sb.from("flashcards").update(input).eq("id", id).select().single());

export const deleteFlashcard = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("flashcards").delete().eq("id", id));
};

export async function reviewFlashcard(sb: SupabaseClient, card: Flashcard, rating: Rating) {
  const next = scheduleReview(card, rating);
  const updated = unwrap<Flashcard>(await sb.from("flashcards").update(next).eq("id", card.id).select().single());
  unwrap(await sb.from("flashcard_reviews").insert({ flashcard_id: card.id, rating, interval_days: next.interval_days }));
  return updated;
}

export const listReviews = async (sb: SupabaseClient, since?: Date) => {
  let q = sb.from("flashcard_reviews").select("*").order("reviewed_at", { ascending: false }).limit(5000);
  if (since) q = q.gte("reviewed_at", since.toISOString());
  return unwrap<FlashcardReview[]>(await q);
};

// ── AI conversations ──
export const listConversations = async (sb: SupabaseClient) =>
  unwrap<AIConversation[]>(await sb.from("ai_conversations").select("*").order("updated_at", { ascending: false }).limit(100));

export const listMessages = async (sb: SupabaseClient, conversationId: string) =>
  unwrap<AIMessage[]>(await sb.from("ai_messages").select("*").eq("conversation_id", conversationId).order("created_at"));

export const deleteConversation = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("ai_conversations").delete().eq("id", id));
};

// ── profile ──
export const getProfile = async (sb: SupabaseClient, id: string) =>
  unwrap<Profile>(await sb.from("profiles").select("*").eq("id", id).single());

export type ProfilePatch = Partial<Omit<Profile, "id" | "created_at" | "updated_at">>;

export const updateProfile = async (sb: SupabaseClient, id: string, patch: ProfilePatch) =>
  unwrap<Profile>(await sb.from("profiles").update(patch).eq("id", id).select().single());
