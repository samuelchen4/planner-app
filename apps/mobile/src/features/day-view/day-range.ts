import { addDays, dateKey, startOfWeek } from './time';

/**
 * The browsable span of days, shared by the date strip and the day canvas so their indices line up.
 * Starts on a Sunday, `weeksEachWay` whole weeks before this week.
 */
export interface DayRange {
  days: Date[];
  keys: string[];
  indexOf: Map<string, number>;
  todayKey: string;
  todayIndex: number;
  /** Index of this week's Sunday. */
  thisWeekIndex: number;
}

export function buildDayRange(today = new Date(), weeksEachWay = 104): DayRange {
  const first = addDays(startOfWeek(today), -weeksEachWay * 7);
  const days = Array.from({ length: (weeksEachWay * 2 + 1) * 7 }, (_, i) => addDays(first, i));
  const keys = days.map(dateKey);
  const thisWeekIndex = weeksEachWay * 7;
  return {
    days,
    keys,
    indexOf: new Map(keys.map((k, i) => [k, i])),
    todayKey: dateKey(today),
    todayIndex: thisWeekIndex + today.getDay(),
    thisWeekIndex,
  };
}
