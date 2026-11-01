import type { Profile } from "@/types/database";
import type { Availability } from "./scheduler";

export const availabilityFromProfile = (p: Profile | undefined): Availability => ({
  studyDays: p?.study_days ?? [1, 2, 3, 4, 5],
  windowStart: p?.study_window_start ?? "16:00",
  windowEnd: p?.study_window_end ?? "21:00",
  sessionMinutes: p?.session_minutes ?? 45,
});
