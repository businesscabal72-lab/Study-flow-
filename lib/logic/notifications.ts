import type { Assignment, Exam, Flashcard, NotificationPrefs } from "@/types/database";

export interface AppNotification {
  id: string;
  kind: "overdue" | "due_today" | "exam" | "flashcards";
  title: string;
  detail: string;
  href: string;
}

const DAY = 86_400_000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Derive reminders from real records — nothing is invented. */
export function buildNotifications(
  input: { assignments: Assignment[]; exams: Exam[]; flashcards: Flashcard[]; prefs: NotificationPrefs },
  now = new Date()
): AppNotification[] {
  const out: AppNotification[] = [];
  const pending = input.assignments.filter((a) => a.status !== "completed");

  if (input.prefs.overdue) {
    for (const a of pending.filter((a) => new Date(a.due_date) < now).slice(0, 5)) {
      out.push({ id: `od-${a.id}`, kind: "overdue", title: a.title, detail: "Overdue", href: "/assignments" });
    }
  }
  if (input.prefs.due_today) {
    for (const a of pending.filter((a) => new Date(a.due_date) >= now && sameDay(new Date(a.due_date), now)).slice(0, 5)) {
      out.push({ id: `dt-${a.id}`, kind: "due_today", title: a.title, detail: "Due today", href: "/assignments" });
    }
  }
  if (input.prefs.exams) {
    for (const e of input.exams.filter((e) => {
      const t = new Date(e.exam_date).getTime();
      return t >= now.getTime() && t - now.getTime() <= 3 * DAY;
    })) {
      const days = Math.max(0, Math.ceil((new Date(e.exam_date).getTime() - now.getTime()) / DAY));
      out.push({ id: `ex-${e.id}`, kind: "exam", title: e.title, detail: days === 0 ? "Exam today" : `Exam in ${days} day${days === 1 ? "" : "s"}`, href: "/exams" });
    }
  }
  if (input.prefs.flashcards) {
    const due = input.flashcards.filter((f) => new Date(f.next_review_at) <= now).length;
    if (due > 0) out.push({ id: "fc", kind: "flashcards", title: `${due} flashcard${due === 1 ? "" : "s"} due`, detail: "Ready to review", href: "/flashcards" });
  }
  return out;
}
