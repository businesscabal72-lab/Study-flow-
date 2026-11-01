/**
 * Basic spaced repetition (a simplified SM-2).
 *  - Difficult: card resets and comes back in 10 minutes; ease drops.
 *  - Medium:    1 day → 3 days → interval × ease.
 *  - Easy:      2 days → 4 days → interval × ease × 1.3; ease rises.
 */
export type SrsRating = "easy" | "medium" | "difficult";

export interface SrsState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface SrsResult extends SrsState {
  next_review_at: string;
  last_reviewed_at: string;
  difficulty: SrsRating;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_INTERVAL_DAYS = 365;
const DAY_MS = 86_400_000;
const RELEARN_MS = 10 * 60_000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function scheduleReview(card: SrsState, rating: SrsRating, now: Date = new Date()): SrsResult {
  let ease = Number(card.ease_factor) || 2.5;
  let reps = Math.max(0, card.repetitions | 0);
  const prev = Math.max(0, card.interval_days | 0);
  let interval: number;
  let nextMs: number;

  if (rating === "difficult") {
    ease = clamp(ease - 0.2, MIN_EASE, MAX_EASE);
    reps = 0;
    interval = 0;
    nextMs = now.getTime() + RELEARN_MS;
  } else {
    if (rating === "easy") {
      interval = reps === 0 ? 2 : reps === 1 ? 4 : Math.round(Math.max(prev, 1) * ease * 1.3);
      ease = clamp(ease + 0.15, MIN_EASE, MAX_EASE);
    } else {
      interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(Math.max(prev, 1) * ease);
      ease = clamp(ease - 0.02, MIN_EASE, MAX_EASE);
    }
    interval = clamp(Math.max(interval, prev + (reps > 1 ? 1 : 0)), 1, MAX_INTERVAL_DAYS);
    reps += 1;
    nextMs = now.getTime() + interval * DAY_MS;
  }

  return {
    ease_factor: round2(ease),
    interval_days: interval,
    repetitions: reps,
    next_review_at: new Date(nextMs).toISOString(),
    last_reviewed_at: now.toISOString(),
    difficulty: rating,
  };
}

export const isDue = (nextReviewAt: string, now = new Date()) => new Date(nextReviewAt).getTime() <= now.getTime();

/** Human preview of the next interval for each button, e.g. "10m", "3d". */
export function previewInterval(card: SrsState, rating: SrsRating, now = new Date()): string {
  const r = scheduleReview(card, rating, now);
  const ms = new Date(r.next_review_at).getTime() - now.getTime();
  if (ms < DAY_MS) return `${Math.round(ms / 60_000)}m`;
  const d = Math.round(ms / DAY_MS);
  return d >= 30 ? `${Math.round(d / 30)}mo` : `${d}d`;
}
