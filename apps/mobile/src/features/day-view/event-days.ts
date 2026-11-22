// Where a mirrored calendar event shows in the day view, in the device's local time zone. Pure
// (no React), so it can be checked on its own.

import {
  addDays,
  dateKey,
  DEFAULT_DURATION_MIN,
  MINUTES_PER_DAY,
  parseDateKey,
  parseTimestamp,
} from './time';

/** The event fields placement needs. */
export interface EventTimes {
  start_at: string | null;
  end_at: string | null;
  /** 'YYYY-MM-DD'; the end is exclusive (the day after the last day). */
  all_day_start: string | null;
  all_day_end: string | null;
}

/** A timed event's piece on one local day, in minutes since that day's midnight (end ≤ 1440). */
export interface TimedSegment {
  day: string;
  startMin: number;
  endMin: number;
}

export type EventPlacement =
  | { kind: 'timed'; segments: TimedSegment[] }
  | { kind: 'allDay'; days: string[] }
  | { kind: 'none' };

/** Longest span drawn, so a broken or endless event can't fill years of days. */
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

const minutesIntoDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Every local day from `first` up to, not including, `endExclusive` (at least `first`). */
export function daysBetween(first: string, endExclusive: string | null): string[] {
  const days = [first];
  if (!endExclusive) return days;
  let d = parseDateKey(first);
  for (let i = 1; i < MAX_DAYS; i++) {
    d = addDays(d, 1);
    const key = dateKey(d);
    if (key >= endExclusive) break;
    days.push(key);
  }
  return days;
}

/**
 * Where an event goes:
 * - all-day events: the all-day area of each day they cover (end date exclusive);
 * - timed events lasting a day or more: the all-day area of each local day they touch (like
 *   Google Calendar's own app);
 * - other timed events: a block per local day they touch, so one running past midnight shows
 *   until midnight on its first day and from midnight on the next.
 */
export function placeEvent(e: EventTimes): EventPlacement {
  if (!e.start_at) {
    return e.all_day_start
      ? { kind: 'allDay', days: daysBetween(e.all_day_start, e.all_day_end) }
      : { kind: 'none' };
  }
  const start = parseTimestamp(e.start_at);
  if (Number.isNaN(start.getTime())) return { kind: 'none' };
  const parsedEnd = e.end_at ? parseTimestamp(e.end_at) : null;
  const end =
    parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? parsedEnd
      : new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);

  if (end.getTime() - start.getTime() >= DAY_MS) {
    // The day holding its last moment (an end exactly at midnight belongs to the day before).
    const last = new Date(end.getTime() - 1);
    return {
      kind: 'allDay',
      days: daysBetween(dateKey(start), dateKey(addDays(last, 1))),
    };
  }

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const segments: TimedSegment[] = [];
  const first = minutesIntoDay(start);
  if (end <= start) {
    // Zero-length (or broken) events: a moment, drawn at the shortest block height.
    return { kind: 'timed', segments: [{ day: dateKey(start), startMin: first, endMin: first }] };
  }
  for (let midnight = startDay; midnight < end;) {
    const next = addDays(midnight, 1);
    segments.push({
      day: dateKey(midnight),
      startMin: midnight.getTime() === startDay.getTime() ? first : 0,
      endMin: end >= next ? MINUTES_PER_DAY : minutesIntoDay(end),
    });
    midnight = next;
  }
  return { kind: 'timed', segments };
}

/** '#RGB' / '#RRGGBB' → 'rgba(r, g, b, alpha)'; null for anything else. */
export function hexWithAlpha(hex: string | null | undefined, alpha: number): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
