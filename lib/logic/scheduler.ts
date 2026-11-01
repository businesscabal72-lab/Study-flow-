/**
 * Smart scheduling: find free study blocks inside the student's availability
 * and distribute work toward upcoming deadlines. Pure functions — the UI
 * always shows results as editable suggestions before anything is saved.
 */

export interface Availability {
  studyDays: number[]; // 0 = Sunday … 6 = Saturday
  windowStart: string; // "HH:MM" or "HH:MM:SS"
  windowEnd: string;
  sessionMinutes: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface Target {
  id: string;
  kind: "assignment" | "exam";
  title: string;
  subjectId: string | null;
  due: Date;
  priority?: "low" | "medium" | "high";
}

export interface Suggestion extends Interval {
  key: string;
  title: string;
  subjectId: string | null;
  reason: string;
  targetId: string | null;
}

const MIN = 60_000;
const DAY = 86_400_000;
const BREAK_MIN = 10;

function parseHM(v: string): [number, number] {
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Chronological free blocks of `sessionMinutes` within availability windows, avoiding busy intervals. */
export function findFreeSlots(from: Date, until: Date, availability: Availability, busy: Interval[]): Interval[] {
  const slots: Interval[] = [];
  const len = Math.max(15, availability.sessionMinutes) * MIN;
  const [sh, sm] = parseHM(availability.windowStart);
  const [eh, em] = parseHM(availability.windowEnd);
  const sortedBusy = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());

  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day < until) {
    if (availability.studyDays.includes(day.getDay())) {
      const winStart = new Date(day);
      winStart.setHours(sh, sm, 0, 0);
      const winEnd = new Date(day);
      winEnd.setHours(eh, em, 0, 0);

      let cursor = new Date(Math.max(winStart.getTime(), roundUpToQuarter(from).getTime()));
      while (cursor.getTime() + len <= Math.min(winEnd.getTime(), until.getTime())) {
        const candidate = { start: new Date(cursor), end: new Date(cursor.getTime() + len) };
        const clash = sortedBusy.find((b) => overlaps(candidate, b));
        if (clash) {
          cursor = roundUpToQuarter(new Date(clash.end.getTime()));
          continue;
        }
        slots.push(candidate);
        cursor = new Date(candidate.end.getTime() + BREAK_MIN * MIN);
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return slots;
}

function roundUpToQuarter(d: Date): Date {
  const r = new Date(d);
  r.setSeconds(0, 0);
  const m = r.getMinutes();
  const add = (15 - (m % 15)) % 15;
  r.setMinutes(m + add);
  return r;
}

function urgency(t: Target, at: Date): number {
  const daysLeft = Math.max(0.25, (t.due.getTime() - at.getTime()) / DAY);
  const kindWeight = t.kind === "exam" ? 2 : 1;
  const prioWeight = t.priority === "high" ? 1.5 : t.priority === "low" ? 0.7 : 1;
  return (kindWeight * prioWeight) / daysLeft;
}

/**
 * Suggest study blocks for the next `days` days. Each free slot goes to the
 * most urgent target still due after that slot; targets that already got
 * blocks are down-weighted so work is spread out.
 */
export function suggestStudyBlocks(opts: {
  now: Date;
  days?: number;
  availability: Availability;
  busy: Interval[];
  targets: Target[];
  maxPerDay?: number;
}): Suggestion[] {
  const { now, availability, busy, targets } = opts;
  const days = opts.days ?? 7;
  const maxPerDay = opts.maxPerDay ?? 2;
  const until = new Date(now.getTime() + days * DAY);
  const live = targets.filter((t) => t.due > now);
  if (live.length === 0) return [];

  const slots = findFreeSlots(now, until, availability, busy);
  const allocated = new Map<string, number>();
  const perDay = new Map<string, number>();
  const out: Suggestion[] = [];

  for (const slot of slots) {
    const dayKey = slot.start.toDateString();
    if ((perDay.get(dayKey) ?? 0) >= maxPerDay) continue;
    const candidates = live.filter((t) => t.due.getTime() >= slot.end.getTime());
    if (candidates.length === 0) continue;
    let best: Target | null = null;
    let bestScore = -1;
    for (const t of candidates) {
      const score = urgency(t, slot.start) / (1 + (allocated.get(t.id) ?? 0));
      if (score > bestScore) {
        best = t;
        bestScore = score;
      }
    }
    if (!best) continue;
    allocated.set(best.id, (allocated.get(best.id) ?? 0) + 1);
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1);
    const daysLeft = Math.ceil((best.due.getTime() - slot.start.getTime()) / DAY);
    out.push({
      key: `${best.id}-${slot.start.getTime()}`,
      start: slot.start,
      end: slot.end,
      title: best.kind === "exam" ? `Prepare: ${best.title}` : `Work on: ${best.title}`,
      subjectId: best.subjectId,
      targetId: best.id,
      reason: `${best.kind === "exam" ? "Exam" : "Assignment"} due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    });
  }
  return out;
}

export interface RevisionChapter {
  id: string;
  title: string;
  status: "not_started" | "learning" | "completed" | "needs_revision";
}

const ORDER: Record<RevisionChapter["status"], number> = { needs_revision: 0, not_started: 1, learning: 2, completed: 3 };

/**
 * Distribute unfinished chapters across free slots before the exam
 * (stopping at the end of the day before the exam). Returns the plan plus
 * any chapters that didn't fit so the UI can tell the student honestly.
 */
export function planRevision(opts: {
  now: Date;
  examDate: Date;
  chapters: RevisionChapter[];
  availability: Availability;
  busy: Interval[];
  subjectId: string | null;
  examTitle: string;
}): { plan: Suggestion[]; unscheduled: RevisionChapter[] } {
  const pending = opts.chapters
    .filter((c) => c.status !== "completed")
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  if (pending.length === 0) return { plan: [], unscheduled: [] };

  const cutoff = new Date(opts.examDate);
  cutoff.setHours(0, 0, 0, 0);
  if (cutoff <= opts.now) return { plan: [], unscheduled: pending };

  const slots = findFreeSlots(opts.now, cutoff, opts.availability, opts.busy);
  const plan: Suggestion[] = [];
  pending.forEach((ch, i) => {
    const slot = slots[i];
    if (!slot) return;
    plan.push({
      key: `${ch.id}-${slot.start.getTime()}`,
      start: slot.start,
      end: slot.end,
      title: `Revise: ${ch.title}`,
      subjectId: opts.subjectId,
      targetId: ch.id,
      reason: `${opts.examTitle} · ${ch.status === "needs_revision" ? "needs revision" : ch.status === "learning" ? "in progress" : "not started"}`,
    });
  });
  return { plan, unscheduled: pending.slice(plan.length) };
}
