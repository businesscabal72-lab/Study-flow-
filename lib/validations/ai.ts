import { z } from "zod";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid id");

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_NOTE_CONTEXT_CHARS = 16000;

export const chatRequestSchema = z.object({
  conversationId: uuid.nullable().optional(),
  message: z.string().trim().min(1, "Type a message first.").max(MAX_MESSAGE_CHARS, `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`),
  noteIds: z.array(uuid).max(3, "You can attach up to 3 notes.").optional().default([]),
});

export const noteActionSchema = z.object({
  noteId: uuid,
  action: z.enum(["summarize", "explain", "key_points", "questions"]),
});

export const flashcardRequestSchema = z.object({
  noteId: uuid,
  count: z.number().int().min(3).max(15).optional().default(8),
});

export const flashcardResponseSchema = z.object({
  cards: z
    .array(z.object({ question: z.string().trim().min(1).max(1000), answer: z.string().trim().min(1).max(3000) }))
    .min(1)
    .max(20),
});
