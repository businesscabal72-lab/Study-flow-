/** Metric calculations over real database rows. No synthetic numbers. */

export interface MinutesRecord {
  at: string | Date;
  minutes: number;
  subjectId?: string | null;
}

const DAY = 86_400_000;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function startOfWeek(d: Date, weekStartsOn = 1): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const diff = (r.getDay() - weekStartsOn + 7) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Minutes per day for the 7 days starting at `weekStart`. */
export function weeklyBuckets(records: MinutesRecord[], weekStart: Date): { day: string; date: string; minutes: number }[] {
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { day: WEEKDAY[d.getDay()], date: d.toISOString(), key: dayKey(d), minutes: 0 };
  });
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const r of records) {
    const i = idx.get(dayKey(new Date(r.at)));
    if (i !== undefined) buckets[i].minutes += r.minutes;
  }
  return buckets.map(({ day, date, minutes }) => ({ day, date, minutes: Math.round(minutes) }));
}

export function sumMinutes(records: MinutesRecord[], from?: Date, to?: Date): number {
  return Math.round(
    records
      .filter((r) => {
        const t = new Date(r.at).getTime();
        return (!from || t >= from.getTime()) && (!to || t < to.getTime());
      })
      .reduce((a, r) => a + r.minutes, 0)
  );
}

/** Consecutive days (ending today, or yesterday if nothing yet today) with any activity. */
export function currentStreak(activityDates: (string | Date)[], today = new Date()): number {
  const days = new Set(activityDates.map((d) => dayKey(new Date(d))));
  const cursor = startOfDay(today);
  if (!days.has(dayKey(cursor))) cursor.setTime(cursor.getTime() - DAY);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Active days per week for the last `weeks` weeks (oldest first). */
export function consistencyByWeek(activityDates: (string | Date)[], weeks: number, today = new Date()) {
  const days = new Set(activityDates.map((d) => dayKey(new Date(d))));
  const thisWeek = startOfWeek(today);
  return Array.from({ length: weeks }, (_, i) => {
    const ws = new Date(thisWeek);
    ws.setDate(ws.getDate() - (weeks - 1 - i) * 7);
    let active = 0;
    for (let k = 0; k < 7; k++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + k);
      if (days.has(dayKey(d))) active++;
    }
    const label = `${ws.toLocaleString("en", { month: "short" })} ${ws.getDate()}`;
    return { week: label, activeDays: active };
  });
}

export function groupMinutesBySubject(records: MinutesRecord[]): Map<string | null, number> {
  const m = new Map<string | null, number>();
  for (const r of records) m.set(r.subjectId ?? null, (m.get(r.subjectId ?? null) ?? 0) + r.minutes);
  return m;
}

export const sessionMinutes = (start: string, end: string) =>
  Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 60_000);

/** Share of chapters completed, 0–100. Empty → 0. */
export function chapterProgress(statuses: string[]): number {
  if (statuses.length === 0) return 0;
  return Math.round((statuses.filter((s) => s === "completed").length / statuses.length) * 100);
}
