import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInCalendarDays,
  isPast,
} from "date-fns";
import type { AssignmentStatus, ChapterStatus, ExamType, Priority } from "@/types/database";

export const fmtDate = (d: string | Date) => format(new Date(d), "MMM d, yyyy");
export const fmtShortDate = (d: string | Date) => format(new Date(d), "MMM d");
export const fmtTime = (d: string | Date) => format(new Date(d), "h:mm a");
export const fmtDateTime = (d: string | Date) => format(new Date(d), "MMM d, h:mm a");

export function fmtRelativeDay(d: string | Date) {
  const date = new Date(d);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  const diff = differenceInCalendarDays(date, new Date());
  if (diff > 0 && diff < 7) return format(date, "EEEE");
  return format(date, "MMM d");
}

export function fmtDue(d: string | Date) {
  const date = new Date(d);
  const label = fmtRelativeDay(date);
  return `${label}, ${format(date, "h:mm a")}`;
}

export const fmtAgo = (d: string | Date) => `${formatDistanceToNowStrict(new Date(d))} ago`;

export function fmtMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const daysUntil = (d: string | Date) => differenceInCalendarDays(new Date(d), new Date());

export const isOverdue = (due: string, status: AssignmentStatus) => status !== "completed" && isPast(new Date(due));

/** <input type="datetime-local"> value from an ISO string (local time). */
export const toLocalInput = (d: string | Date) => format(new Date(d), "yyyy-MM-dd'T'HH:mm");
export const toDateInput = (d: string | Date) => format(new Date(d), "yyyy-MM-dd");
/** Parse a datetime-local value as local time → ISO (UTC). */
export const fromLocalInput = (v: string) => new Date(v).toISOString();

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  not_started: "Not started",
  learning: "Learning",
  completed: "Completed",
  needs_revision: "Needs revision",
};
export const CHAPTER_STATUS_BADGE: Record<ChapterStatus, "default" | "lavender" | "sage" | "warning"> = {
  not_started: "default",
  learning: "lavender",
  completed: "sage",
  needs_revision: "warning",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
export const PRIORITY_BADGE: Record<Priority, "default" | "sand" | "destructive"> = {
  low: "default",
  medium: "sand",
  high: "destructive",
};

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  quiz: "Quiz",
  unit_test: "Unit test",
  midterm: "Midterm",
  final: "Final",
  practical: "Practical",
  oral: "Oral",
  other: "Other",
};

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string")
    return (e as { message: string }).message;
  return fallback;
}
