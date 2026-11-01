"use client";
import { useDbMutation } from "./use-mutation";
import { qk } from "@/lib/data/core";
import { updateAssignment, updateSession } from "@/lib/data/planner";
import type { AssignmentStatus, SessionStatus } from "@/types/database";

/** Shared quick actions used across dashboard, lists and calendars. */
export function useSetAssignmentStatus() {
  return useDbMutation((sb, v: { id: string; status: AssignmentStatus }) => updateAssignment(sb, v.id, { status: v.status }), {
    invalidate: [qk.assignments],
    success: (_r, v) => (v.status === "completed" ? "Marked complete" : null),
  });
}

export function useSetSessionStatus() {
  return useDbMutation((sb, v: { id: string; status: SessionStatus }) => updateSession(sb, v.id, { status: v.status }), {
    invalidate: [qk.sessions],
    success: (_r, v) => (v.status === "completed" ? "Session completed" : null),
  });
}
