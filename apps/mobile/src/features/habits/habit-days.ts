import type { HabitDay } from '@planner/core';

import { addDays, dateKey, toLocalIso } from '@/features/day-view/time';

/**
 * The last 7 days, oldest first, ending with today. (A calendar week would be mostly future days
 * early in the week, hiding the recent history.)
 */
export function recentDays(today: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

/** The days ('YYYY-MM-DD') each habit was done, by habit id. */
export function doneByHabit(days: HabitDay[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const d of days) {
    if (!d.done) continue;
    const set = map.get(d.habitId) ?? new Set<string>();
    set.add(d.date);
    map.set(d.habitId, set);
  }
  return map;
}

/**
 * Days in a row the habit was done, ending today, or ending yesterday while today is still open
 * (a streak isn't broken until a whole day passes unchecked).
 */
export function streak(days: Set<string>, today: Date): number {
  let d = days.has(dateKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(dateKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Change one day of a habit (creating its row); a row left with neither done nor note goes. */
function updateHabitDay(
  days: HabitDay[],
  habitId: string,
  userId: string,
  day: Date,
  change: (row: HabitDay) => HabitDay,
): HabitDay[] {
  const date = dateKey(day);
  const at = days.findIndex((d) => d.habitId === habitId && d.date === date);
  const base: HabitDay = at >= 0 ? days[at] : { habitId, userId, date, done: false, updatedAt: '' };
  const row = { ...change(base), updatedAt: toLocalIso(new Date()) };
  const keep = row.done || !!row.note?.trim();
  if (at < 0) return keep ? [...days, row] : days;
  return keep ? days.map((d, i) => (i === at ? row : d)) : days.filter((_, i) => i !== at);
}

/** Check the habit off on `day`, or un-check it. */
export function toggleHabitDay(
  days: HabitDay[],
  habitId: string,
  userId: string,
  day: Date,
): HabitDay[] {
  return updateHabitDay(days, habitId, userId, day, (r) => ({ ...r, done: !r.done }));
}

/** Set the habit's note for `day` (empty removes it). */
export function setHabitDayNote(
  days: HabitDay[],
  habitId: string,
  userId: string,
  day: Date,
  note: string,
): HabitDay[] {
  return updateHabitDay(days, habitId, userId, day, (r) => ({
    ...r,
    note: note.trim() ? note : undefined,
  }));
}
