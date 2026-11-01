import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Assignment,
  AssignmentStatus,
  ChapterStatus,
  Exam,
  ExamChapterWithTitle,
  ExamType,
  Priority,
  StudySession,
  SessionStatus,
} from "@/types/database";
import { unwrap } from "./core";

// ── assignments ──
export interface AssignmentInput {
  title: string;
  description?: string | null;
  subject_id?: string | null;
  due_date: string;
  priority: Priority;
  status: AssignmentStatus;
}

export const listAssignments = async (sb: SupabaseClient) =>
  unwrap<Assignment[]>(await sb.from("assignments").select("*").order("due_date", { ascending: true }));

export const createAssignment = async (sb: SupabaseClient, input: AssignmentInput) =>
  unwrap<Assignment>(await sb.from("assignments").insert(input).select().single());

export const updateAssignment = async (sb: SupabaseClient, id: string, input: Partial<AssignmentInput>) =>
  unwrap<Assignment>(await sb.from("assignments").update(input).eq("id", id).select().single());

export const deleteAssignment = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("assignments").delete().eq("id", id));
};

// ── study sessions ──
export interface SessionInput {
  title: string;
  description?: string | null;
  subject_id?: string | null;
  start_time: string;
  end_time: string;
  status?: SessionStatus;
}

export const listSessions = async (sb: SupabaseClient, from: Date, to: Date) =>
  unwrap<StudySession[]>(
    await sb
      .from("study_sessions")
      .select("*")
      .gte("start_time", from.toISOString())
      .lt("start_time", to.toISOString())
      .order("start_time")
  );

export const createSession = async (sb: SupabaseClient, input: SessionInput) =>
  unwrap<StudySession>(await sb.from("study_sessions").insert(input).select().single());

export const createSessions = async (sb: SupabaseClient, inputs: SessionInput[]) =>
  unwrap<StudySession[]>(await sb.from("study_sessions").insert(inputs).select());

export const updateSession = async (sb: SupabaseClient, id: string, input: Partial<SessionInput>) =>
  unwrap<StudySession>(await sb.from("study_sessions").update(input).eq("id", id).select().single());

export const deleteSession = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("study_sessions").delete().eq("id", id));
};

// ── exams ──
export interface ExamWithChapters extends Exam {
  exam_chapters: ExamChapterWithTitle[];
}

export interface ExamInput {
  title: string;
  subject_id?: string | null;
  exam_date: string;
  exam_type: ExamType;
  notes?: string | null;
}

export const listExams = async (sb: SupabaseClient) =>
  unwrap<ExamWithChapters[]>(
    await sb.from("exams").select("*, exam_chapters(*, chapters(title, subject_id))").order("exam_date", { ascending: true })
  );

export async function saveExam(sb: SupabaseClient, input: ExamInput, chapterIds: string[], id?: string) {
  const exam = id
    ? unwrap<Exam>(await sb.from("exams").update(input).eq("id", id).select().single())
    : unwrap<Exam>(await sb.from("exams").insert(input).select().single());

  // Sync syllabus: remove deselected chapters, add new ones (keep existing statuses).
  const existing = unwrap<{ chapter_id: string }[]>(await sb.from("exam_chapters").select("chapter_id").eq("exam_id", exam.id));
  const have = new Set(existing.map((e) => e.chapter_id));
  const want = new Set(chapterIds);
  const toRemove = [...have].filter((c) => !want.has(c));
  const toAdd = [...want].filter((c) => !have.has(c));
  if (toRemove.length) unwrap(await sb.from("exam_chapters").delete().eq("exam_id", exam.id).in("chapter_id", toRemove));
  if (toAdd.length) {
    // Start each syllabus item from the chapter's current study status.
    const chapters = unwrap<{ id: string; status: ChapterStatus }[]>(await sb.from("chapters").select("id,status").in("id", toAdd));
    unwrap(
      await sb.from("exam_chapters").insert(chapters.map((c) => ({ exam_id: exam.id, chapter_id: c.id, revision_status: c.status })))
    );
  }
  return exam;
}

export const deleteExam = async (sb: SupabaseClient, id: string) => {
  unwrap(await sb.from("exams").delete().eq("id", id));
};

/** Update a syllabus item and keep the underlying chapter status in sync. */
export async function setExamChapterStatus(sb: SupabaseClient, examChapterId: string, chapterId: string, status: ChapterStatus) {
  unwrap(await sb.from("exam_chapters").update({ revision_status: status }).eq("id", examChapterId));
  unwrap(await sb.from("chapters").update({ status }).eq("id", chapterId));
}
