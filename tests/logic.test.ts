import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleReview, isDue, MIN_EASE } from "../lib/logic/srs";
import { findFreeSlots, suggestStudyBlocks, planRevision, type Availability } from "../lib/logic/scheduler";
import * as T from "../lib/logic/timer";
import { weeklyBuckets, currentStreak, startOfWeek, chapterProgress, consistencyByWeek } from "../lib/logic/analytics";

const DAY = 86_400_000;
const fresh = { ease_factor: 2.5, interval_days: 0, repetitions: 0 };

test("srs: difficult resets and returns in 10 minutes", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  const r = scheduleReview({ ease_factor: 2.5, interval_days: 12, repetitions: 4 }, "difficult", now);
  assert.equal(r.repetitions, 0);
  assert.equal(r.interval_days, 0);
  assert.equal(new Date(r.next_review_at).getTime() - now.getTime(), 10 * 60_000);
  assert.equal(r.ease_factor, 2.3);
});

test("srs: intervals grow with medium/easy and easy grows faster", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  let m = { ...fresh }, e = { ...fresh };
  const mi: number[] = [], ei: number[] = [];
  for (let i = 0; i < 4; i++) {
    const rm = scheduleReview(m, "medium", now); m = rm; mi.push(rm.interval_days);
    const re = scheduleReview(e, "easy", now); e = re; ei.push(re.interval_days);
  }
  assert.deepEqual(mi.slice(0, 2), [1, 3]);
  assert.deepEqual(ei.slice(0, 2), [2, 4]);
  for (let i = 1; i < 4; i++) { assert.ok(mi[i] > mi[i - 1]); assert.ok(ei[i] > ei[i - 1]); }
  assert.ok(ei[3] > mi[3]);
});

test("srs: ease never drops below minimum; due check", () => {
  let c = { ...fresh };
  for (let i = 0; i < 20; i++) c = scheduleReview(c, "difficult");
  assert.equal(c.ease_factor, MIN_EASE);
  assert.ok(isDue(new Date(Date.now() - 1000).toISOString()));
  assert.ok(!isDue(new Date(Date.now() + 60_000).toISOString()));
});

const avail: Availability = { studyDays: [0, 1, 2, 3, 4, 5, 6], windowStart: "16:00", windowEnd: "20:00", sessionMinutes: 45 };

test("scheduler: free slots respect window, length and busy blocks", () => {
  const from = new Date(2026, 10, 2, 8, 0); // Mon 8:00 local
  const until = new Date(2026, 10, 3, 0, 0);
  const busy = [{ start: new Date(2026, 10, 2, 17, 0), end: new Date(2026, 10, 2, 18, 0) }];
  const slots = findFreeSlots(from, until, avail, busy);
  assert.ok(slots.length >= 2);
  for (const s of slots) {
    assert.equal(s.end.getTime() - s.start.getTime(), 45 * 60_000);
    assert.ok(s.start.getHours() >= 16);
    assert.ok(s.end.getHours() < 20 || (s.end.getHours() === 20 && s.end.getMinutes() === 0));
    assert.ok(!(s.start < busy[0].end && busy[0].start < s.end), "overlaps busy");
  }
});

test("scheduler: skips non-study days", () => {
  const from = new Date(2026, 10, 1, 8, 0); // Sunday
  const until = new Date(2026, 10, 2, 0, 0);
  assert.equal(findFreeSlots(from, until, { ...avail, studyDays: [1, 2, 3, 4, 5] }, []).length, 0);
});

test("scheduler: suggestions favour urgent targets and never schedule after a deadline", () => {
  const now = new Date(2026, 10, 2, 9, 0);
  const soon = { id: "a", kind: "assignment" as const, title: "Essay", subjectId: null, due: new Date(2026, 10, 3, 23, 0), priority: "high" as const };
  const later = { id: "b", kind: "exam" as const, title: "Final", subjectId: "s", due: new Date(2026, 10, 9, 9, 0) };
  const out = suggestStudyBlocks({ now, availability: avail, busy: [], targets: [soon, later] });
  assert.ok(out.length > 0);
  assert.equal(out[0].targetId, "a");
  for (const s of out) {
    const t = s.targetId === "a" ? soon : later;
    assert.ok(s.end <= t.due);
  }
  const perDay = new Map<string, number>();
  out.forEach((s) => perDay.set(s.start.toDateString(), (perDay.get(s.start.toDateString()) ?? 0) + 1));
  for (const n of perDay.values()) assert.ok(n <= 2);
});

test("scheduler: revision plan orders needs_revision first and reports overflow", () => {
  const now = new Date(2026, 10, 2, 9, 0);
  const examDate = new Date(2026, 10, 4, 9, 0); // slots Mon+Tue only
  const chapters = [
    { id: "1", title: "A", status: "not_started" as const },
    { id: "2", title: "B", status: "needs_revision" as const },
    { id: "3", title: "C", status: "completed" as const },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, title: `X${i}`, status: "learning" as const })),
  ];
  const { plan, unscheduled } = planRevision({ now, examDate, chapters, availability: avail, busy: [], subjectId: null, examTitle: "Mock" });
  assert.equal(plan[0].targetId, "2");
  assert.equal(plan[1].targetId, "1");
  assert.ok(!plan.some((p) => p.targetId === "3"));
  assert.ok(plan.every((p) => p.end < new Date(2026, 10, 4, 0, 0)));
  assert.equal(plan.length + unscheduled.length, 14);
  assert.ok(unscheduled.length > 0);
});

test("timer: timestamp-based remaining time survives throttled ticks", () => {
  let s = T.createTimer("focus", 25, "id1");
  s = T.start(s, 0);
  // no ticks for 10 minutes (backgrounded tab)
  assert.equal(T.remaining(s, 10 * 60_000), 15 * 60_000);
  s = T.pause(s, 10 * 60_000);
  assert.equal(T.remaining(s, 99 * 60_000), 15 * 60_000, "paused time is frozen");
  s = T.start(s, 100 * 60_000);
  s = T.tick(s, 100 * 60_000 + 15 * 60_000 + 1);
  assert.equal(s.status, "finished");
  assert.equal(s.focusCount, 1);
  assert.equal(s.startedAt, 0);
  assert.equal(T.formatClock(T.remaining(s, 0)), "00:00");
});

test("timer: long break every 4th focus round", () => {
  let s = T.createTimer("focus", 25, "x", null, 3);
  s = T.tick(T.start(s, 0), 25 * 60_000);
  assert.equal(T.nextMode(s), "long_break");
  const s2 = T.tick(T.start(T.createTimer("focus", 25, "y", null, 0), 0), 25 * 60_000);
  assert.equal(T.nextMode(s2), "short_break");
  assert.equal(T.formatClock(25 * 60_000), "25:00");
});

test("analytics: weekly buckets, streak, progress", () => {
  const ws = startOfWeek(new Date(2026, 10, 4)); // Mon Nov 2
  assert.equal(ws.getDay(), 1);
  const b = weeklyBuckets(
    [
      { at: new Date(2026, 10, 2, 10), minutes: 30 },
      { at: new Date(2026, 10, 2, 18), minutes: 15 },
      { at: new Date(2026, 10, 8, 9), minutes: 20 },
      { at: new Date(2026, 10, 9, 9), minutes: 99 }, // next week — excluded
    ],
    ws
  );
  assert.equal(b.length, 7);
  assert.equal(b[0].minutes, 45);
  assert.equal(b[6].minutes, 20);
  assert.equal(b.reduce((a, x) => a + x.minutes, 0), 65);

  const today = new Date(2026, 10, 5, 12);
  assert.equal(currentStreak([new Date(2026, 10, 5), new Date(2026, 10, 4), new Date(2026, 10, 3), new Date(2026, 10, 1)], today), 3);
  assert.equal(currentStreak([new Date(2026, 10, 4)], today), 1, "yesterday keeps streak alive");
  assert.equal(currentStreak([], today), 0);
  assert.equal(chapterProgress([]), 0);
  assert.equal(chapterProgress(["completed", "learning", "completed", "not_started"]), 50);
  const c = consistencyByWeek([new Date(2026, 10, 3), new Date(2026, 10, 4)], 4, today);
  assert.equal(c.length, 4);
  assert.equal(c[3].activeDays, 2);
});
