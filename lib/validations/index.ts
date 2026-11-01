import { z } from "zod";
import {
  ASSIGNMENT_STATUSES,
  CHAPTER_STATUSES,
  EXAM_TYPES,
  PRIORITIES,
  SUBJECT_COLORS,
} from "@/types/database";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^[0-9a-f-]{36}$/i.test(v), "Invalid selection");

const isoDateTime = z
  .string()
  .min(1, "Pick a date and time")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date");

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(80, "Keep it under 80 characters"),
  description: optionalText(500),
  teacher_name: optionalText(80),
  color: z.enum(SUBJECT_COLORS),
});

export const chapterSchema = z.object({
  title: z.string().trim().min(1, "Chapter title is required").max(120),
  status: z.enum(CHAPTER_STATUSES).default("not_started"),
});

export const resourceSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => /^https?:\/\/\S+\.\S+/i.test(v), "Enter a full link starting with http:// or https://"),
});

export const assignmentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: optionalText(4000),
  subject_id: optionalUuid,
  due_date: isoDateTime,
  priority: z.enum(PRIORITIES),
  status: z.enum(ASSIGNMENT_STATUSES),
});

export const studySessionSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160),
    description: optionalText(2000),
    subject_id: optionalUuid,
    start_time: isoDateTime,
    end_time: isoDateTime,
  })
  .refine((v) => new Date(v.end_time) > new Date(v.start_time), {
    message: "End time must be after the start time",
    path: ["end_time"],
  })
  .refine((v) => new Date(v.end_time).getTime() - new Date(v.start_time).getTime() <= 12 * 3600_000, {
    message: "Sessions can be at most 12 hours",
    path: ["end_time"],
  });

export const examSchema = z.object({
  title: z.string().trim().min(1, "Exam title is required").max(160),
  subject_id: optionalUuid,
  exam_date: isoDateTime,
  exam_type: z.enum(EXAM_TYPES),
  notes: optionalText(2000),
});

export const flashcardSchema = z.object({
  question: z.string().trim().min(1, "Front side is required").max(1000),
  answer: z.string().trim().min(1, "Back side is required").max(3000),
  subject_id: optionalUuid,
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Enter a display name").max(60),
});

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export type FieldErrors = Record<string, string>;

/** Validate with zod and return either parsed data or per-field messages. */
export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown
): { ok: true; data: z.output<T> } | { ok: false; errors: FieldErrors } {
  const res = schema.safeParse(input);
  if (res.success) return { ok: true, data: res.data };
  const errors: FieldErrors = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
