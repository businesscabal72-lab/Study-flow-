// Typed models mirroring supabase/migrations/0001_studyflow_schema.sql.
// (Regenerate with `supabase gen types typescript` if you change the schema.)

export type UUID = string;
export type ISODate = string;

export const SUBJECT_COLORS = ["sage", "lavender", "sand", "sky", "rose", "slate", "amber", "teal"] as const;
export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export const CHAPTER_STATUSES = ["not_started", "learning", "completed", "needs_revision"] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SESSION_STATUSES = ["planned", "completed", "skipped"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const EXAM_TYPES = ["quiz", "unit_test", "midterm", "final", "practical", "oral", "other"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const RATINGS = ["easy", "medium", "difficult"] as const;
export type Rating = (typeof RATINGS)[number];

export interface NotificationPrefs {
  due_today: boolean;
  overdue: boolean;
  exams: boolean;
  flashcards: boolean;
  focus_complete: boolean;
}

export interface Profile {
  id: UUID;
  display_name: string | null;
  avatar_url: string | null;
  onboarded: boolean;
  study_days: number[];
  study_window_start: string; // "HH:MM:SS"
  study_window_end: string;
  session_minutes: number;
  daily_goal_minutes: number;
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  notification_prefs: NotificationPrefs;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Subject {
  id: UUID;
  user_id: UUID;
  name: string;
  description: string | null;
  teacher_name: string | null;
  color: SubjectColor;
  created_at: ISODate;
}

export interface Chapter {
  id: UUID;
  subject_id: UUID;
  user_id: UUID;
  title: string;
  status: ChapterStatus;
  position: number;
  created_at: ISODate;
}

export interface Note {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  title: string;
  content: unknown; // Tiptap JSON document
  content_text: string;
  tags: string[];
  is_pinned: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export type NoteSummary = Omit<Note, "content">;

export interface NoteAttachment {
  id: UUID;
  user_id: UUID;
  note_id: UUID;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: ISODate;
}

export interface SubjectResource {
  id: UUID;
  user_id: UUID;
  subject_id: UUID;
  title: string;
  url: string;
  created_at: ISODate;
}

export interface Assignment {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  title: string;
  description: string | null;
  due_date: ISODate;
  priority: Priority;
  status: AssignmentStatus;
  completed_at: ISODate | null;
  created_at: ISODate;
}

export interface StudySession {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  title: string;
  description: string | null;
  start_time: ISODate;
  end_time: ISODate;
  status: SessionStatus;
  created_at: ISODate;
}

export interface Exam {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  title: string;
  exam_date: ISODate;
  exam_type: ExamType;
  notes: string | null;
  created_at: ISODate;
}

export interface ExamChapter {
  id: UUID;
  user_id: UUID;
  exam_id: UUID;
  chapter_id: UUID;
  revision_status: ChapterStatus;
  created_at: ISODate;
}

export interface ExamChapterWithTitle extends ExamChapter {
  chapters: { title: string; subject_id: UUID } | null;
}

export interface FocusSession {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  duration_minutes: number;
  started_at: ISODate;
  completed_at: ISODate;
  client_id: UUID | null;
}

export interface Flashcard {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  note_id: UUID | null;
  question: string;
  answer: string;
  difficulty: Rating | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: ISODate;
  last_reviewed_at: ISODate | null;
  created_at: ISODate;
}

export interface FlashcardReview {
  id: UUID;
  user_id: UUID;
  flashcard_id: UUID;
  rating: Rating;
  interval_days: number;
  reviewed_at: ISODate;
}

export interface AIConversation {
  id: UUID;
  user_id: UUID;
  title: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface AIMessage {
  id: UUID;
  user_id: UUID;
  conversation_id: UUID;
  role: "user" | "assistant";
  content: string;
  created_at: ISODate;
}
