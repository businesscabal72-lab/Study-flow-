"use client";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { qk } from "@/lib/data/core";
import * as subjects from "@/lib/data/subjects";
import * as notes from "@/lib/data/notes";
import * as planner from "@/lib/data/planner";
import * as practice from "@/lib/data/practice";
import { useSession } from "./use-session";

const sb = () => getSupabaseBrowser();

export const useProfile = () => {
  const { userId } = useSession();
  return useQuery({ queryKey: qk.profile, queryFn: () => practice.getProfile(sb(), userId) });
};

export const useSubjects = () => useQuery({ queryKey: qk.subjects, queryFn: () => subjects.listSubjects(sb()) });
export const useSubject = (id: string) => useQuery({ queryKey: qk.subject(id), queryFn: () => subjects.getSubject(sb(), id) });
export const useChapters = (subjectId?: string) =>
  useQuery({ queryKey: qk.chapters(subjectId), queryFn: () => subjects.listChapters(sb(), subjectId) });
export const useResources = (subjectId: string) =>
  useQuery({ queryKey: qk.resources(subjectId), queryFn: () => subjects.listResources(sb(), subjectId) });

export const useNotes = () => useQuery({ queryKey: qk.notes, queryFn: () => notes.listNotes(sb()) });
export const useNote = (id: string | null) =>
  useQuery({ queryKey: qk.note(id ?? "none"), queryFn: () => notes.getNote(sb(), id!), enabled: !!id, staleTime: Infinity });
export const useAttachments = (noteId: string | null) =>
  useQuery({ queryKey: qk.attachments(noteId ?? "none"), queryFn: () => notes.listAttachments(sb(), noteId!), enabled: !!noteId });

export const useAssignments = () => useQuery({ queryKey: qk.assignments, queryFn: () => planner.listAssignments(sb()) });

export const useSessions = (from: Date, to: Date) =>
  useQuery({
    queryKey: [...qk.sessions, from.toISOString(), to.toISOString()],
    queryFn: () => planner.listSessions(sb(), from, to),
  });

export const useExams = () => useQuery({ queryKey: qk.exams, queryFn: () => planner.listExams(sb()) });

export const useFocusSessions = (since?: Date) =>
  useQuery({
    queryKey: [...qk.focus, since?.toISOString() ?? "all"],
    queryFn: () => practice.listFocusSessions(sb(), since),
  });

export const useFlashcards = () => useQuery({ queryKey: qk.flashcards, queryFn: () => practice.listFlashcards(sb()) });
export const useReviews = (since?: Date) =>
  useQuery({ queryKey: [...qk.reviews, since?.toISOString() ?? "all"], queryFn: () => practice.listReviews(sb(), since) });

export const useConversations = () => useQuery({ queryKey: qk.conversations, queryFn: () => practice.listConversations(sb()) });
export const useMessages = (id: string | null) =>
  useQuery({ queryKey: qk.messages(id ?? "none"), queryFn: () => practice.listMessages(sb(), id!), enabled: !!id });

/** Map subject id → subject for quick lookups in lists. */
export function useSubjectMap() {
  const q = useSubjects();
  const map = new Map((q.data ?? []).map((s) => [s.id, s]));
  return { ...q, map };
}
