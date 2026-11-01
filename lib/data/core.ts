import type { PostgrestError } from "@supabase/supabase-js";

export class DataError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Turn Postgres/PostgREST errors into messages a student can act on. */
export function friendly(error: PostgrestError | { message: string; code?: string }): DataError {
  const code = (error as PostgrestError).code;
  if (code === "23503") return new DataError("That item no longer exists or isn't yours. Refresh and try again.", code);
  if (code === "23505") return new DataError("That already exists.", code);
  if (code === "23514") return new DataError("Some values aren't allowed. Check the form and try again.", code);
  if (code === "42501") return new DataError("You don't have permission to do that.", code);
  if (code === "PGRST116") return new DataError("Not found.", code);
  if (/fetch|network/i.test(error.message)) return new DataError("Can't reach the server. Check your connection.", code);
  return new DataError(error.message || "Something went wrong.", code);
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw friendly(res.error);
  return res.data as T;
}

/** Central query keys so mutations invalidate the right lists. */
export const qk = {
  profile: ["profile"] as const,
  subjects: ["subjects"] as const,
  subject: (id: string) => ["subjects", id] as const,
  chapters: (subjectId?: string) => (subjectId ? (["chapters", subjectId] as const) : (["chapters"] as const)),
  resources: (subjectId: string) => ["resources", subjectId] as const,
  notes: ["notes"] as const,
  note: (id: string) => ["notes", "detail", id] as const,
  attachments: (noteId: string) => ["attachments", noteId] as const,
  assignments: ["assignments"] as const,
  sessions: ["sessions"] as const,
  exams: ["exams"] as const,
  focus: ["focus"] as const,
  flashcards: ["flashcards"] as const,
  reviews: ["reviews"] as const,
  conversations: ["ai", "conversations"] as const,
  messages: (id: string) => ["ai", "messages", id] as const,
};
