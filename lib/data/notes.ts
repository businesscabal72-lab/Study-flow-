import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note, NoteAttachment, NoteSummary } from "@/types/database";
import { DataError, unwrap } from "./core";

const SUMMARY_COLS = "id,user_id,subject_id,title,content_text,tags,is_pinned,created_at,updated_at";

export const listNotes = async (sb: SupabaseClient) =>
  unwrap<NoteSummary[]>(
    await sb.from("notes").select(SUMMARY_COLS).order("is_pinned", { ascending: false }).order("updated_at", { ascending: false })
  );

export const getNote = async (sb: SupabaseClient, id: string) =>
  unwrap<Note>(await sb.from("notes").select("*").eq("id", id).single());

export const createNote = async (sb: SupabaseClient, input: { title?: string; subject_id?: string | null }) =>
  unwrap<Note>(await sb.from("notes").insert({ title: input.title ?? "Untitled", subject_id: input.subject_id ?? null }).select().single());

export type NotePatch = Partial<Pick<Note, "title" | "content" | "content_text" | "tags" | "is_pinned" | "subject_id">>;

export const updateNote = async (sb: SupabaseClient, id: string, patch: NotePatch) =>
  unwrap<Note>(await sb.from("notes").update(patch).eq("id", id).select().single());

export const deleteNote = async (sb: SupabaseClient, id: string) => {
  // Remove stored PDFs first so no orphaned files remain.
  const files = unwrap<{ storage_path: string }[]>(await sb.from("note_attachments").select("storage_path").eq("note_id", id));
  if (files.length) await sb.storage.from("attachments").remove(files.map((f) => f.storage_path));
  unwrap(await sb.from("notes").delete().eq("id", id));
};

// ── attachments ──
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export const listAttachments = async (sb: SupabaseClient, noteId: string) =>
  unwrap<NoteAttachment[]>(await sb.from("note_attachments").select("*").eq("note_id", noteId).order("created_at"));

export async function uploadAttachment(sb: SupabaseClient, userId: string, noteId: string, file: File) {
  if (file.type !== "application/pdf") throw new DataError("Only PDF files can be attached.");
  if (file.size > MAX_PDF_BYTES) throw new DataError("PDFs must be 10 MB or smaller.");
  if (file.size === 0) throw new DataError("That file is empty.");
  const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const path = `${userId}/${noteId}/${crypto.randomUUID()}-${safe}`;
  const up = await sb.storage.from("attachments").upload(path, file, { contentType: "application/pdf", upsert: false });
  if (up.error) throw new DataError(`Upload failed: ${up.error.message}`);
  const res = await sb
    .from("note_attachments")
    .insert({ note_id: noteId, file_name: file.name.slice(0, 200), storage_path: path, size_bytes: file.size, mime_type: "application/pdf" })
    .select()
    .single();
  if (res.error) {
    await sb.storage.from("attachments").remove([path]); // roll back the file
  }
  return unwrap<NoteAttachment>(res);
}

export async function deleteAttachment(sb: SupabaseClient, a: NoteAttachment) {
  const rm = await sb.storage.from("attachments").remove([a.storage_path]);
  if (rm.error) throw new DataError(`Couldn't delete the file: ${rm.error.message}`);
  unwrap(await sb.from("note_attachments").delete().eq("id", a.id));
}

export async function attachmentUrl(sb: SupabaseClient, path: string) {
  const { data, error } = await sb.storage.from("attachments").createSignedUrl(path, 60 * 10);
  if (error || !data) throw new DataError("Couldn't open the file.");
  return data.signedUrl;
}
