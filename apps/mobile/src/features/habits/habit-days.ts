import type { HabitDay } from '@/db/schema';

import { addDays, dateKey } from '@/features/day-view/time';

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
    if (!d.done_at) continue;
    const set = map.get(d.habit_id) ?? new Set<string>();
    set.add(d.date);
    map.set(d.habit_id, set);
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
