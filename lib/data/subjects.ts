import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chapter, ChapterStatus, Subject, SubjectColor, SubjectResource } from "@/types/database";
import { unwrap } from "./core";

export interface SubjectWithStats extends Subject {
  chapters: { id: string; status: ChapterStatus }[];
  notes: { count: number }[];
}

export interface SubjectInput {
  name: string;
  description?: string | null;
  teacher_name?: string | null;
  color: SubjectColor;
}

export const listSubjects = async (sb: SupabaseClient) =>
  unwrap<SubjectWithStats[]>(
    await sb.from("subjects").select("*, chapters(id,status), notes(count)").order("created_at", { ascending: true })
  );

export const getSubject = async (sb: SupabaseClient, id: string) =>
  unwrap<Subject>(await sb.from("subjects").select("*").eq("id", id).single());

export const createSubject = async (sb: SupabaseClient, input: SubjectInput) =>
  unwrap<Subject>(await sb.from("subjects").insert(input).select().single());

export const createSubjects = async (sb: SupabaseClient, inputs: SubjectInput[]) =>
  unwrap<Subject[]>(await sb.from("subjects").insert(inputs).select());

export const updateSubject = async (sb: SupabaseClient, id: string, input: Partial<SubjectInput>) =>
  unwrap<Subject>(await sb.from("subjects").update(input).eq("id", id).select().single());

export const deleteSubject = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("subjects").delete().eq("id", id));
};

// ── chapters ──
export const listChapters = async (sb: SupabaseClient, subjectId?: string) => {
  let q = sb.from("chapters").select("*").order("position").order("created_at");
  if (subjectId) q = q.eq("subject_id", subjectId);
  return unwrap<Chapter[]>(await q);
};

export const createChapter = async (sb: SupabaseClient, input: { subject_id: string; title: string; position: number }) =>
  unwrap<Chapter>(await sb.from("chapters").insert(input).select().single());

export const updateChapter = async (sb: SupabaseClient, id: string, input: Partial<Pick<Chapter, "title" | "status" | "position">>) =>
  unwrap<Chapter>(await sb.from("chapters").update(input).eq("id", id).select().single());

export const deleteChapter = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("chapters").delete().eq("id", id));
};

// ── resources ──
export const listResources = async (sb: SupabaseClient, subjectId: string) =>
  unwrap<SubjectResource[]>(await sb.from("subject_resources").select("*").eq("subject_id", subjectId).order("created_at"));

export const createResource = async (sb: SupabaseClient, input: { subject_id: string; title: string; url: string }) =>
  unwrap<SubjectResource>(await sb.from("subject_resources").insert(input).select().single());

export const deleteResource = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("subject_resources").delete().eq("id", id));
};
