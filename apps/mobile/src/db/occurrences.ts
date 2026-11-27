import { addDaysToKey, occurrenceId, occurrencesBetween, parseRRule } from '@planner/core';

import {
  dateKey,
  isoAtMinutes,
  minutesOfDay,
  parseDateKey,
  parseTimestamp,
  toLocalIso,
} from '@/features/day-view/time';

import type { Task } from './schema';
import { taskTable } from './tables';

// The days of recurring series. A series is a task with `rrule`; it isn't shown itself. Each day
// it falls on is shown as a task of its own (`series_id` + `occurrence_date`): the stored row when
// that day was changed, else a "virtual" copy of the series made here, with the id the day's row
// will get (occurrenceId), so the screens treat both the same. The first change to a virtual day
// saves it as a row (materialize), and from then on that day is independent.

/** How far the day view browses each way (its range is ±104 weeks); days are made for this span. */
const WINDOW_DAYS = 740;

/** The virtual days last made, by id (what materialize saves). */
const virtualById = new Map<string, Task>();

const seriesStart = (series: Task) =>
  series.start_at ? dateKey(parseTimestamp(series.start_at)) : series.all_day_date;

/** A series' copy for `day`: same fields, on that day at the same clock time. */
function virtualDay(series: Task, day: string): Task {
  const base = {
    ...series,
    id: occurrenceId(series.id, day),
    rrule: null,
    series_id: series.id,
    occurrence_date: day,
    status: 'open' as const,
    completed_at: null,
  };
  if (!series.start_at) return { ...base, all_day_date: day };
  const startMin = minutesOfDay(series.start_at);
  const start = isoAtMinutes(toLocalIso(parseDateKey(day)), startMin);
  const durationMs = series.end_at
    ? parseTimestamp(series.end_at).getTime() - parseTimestamp(series.start_at).getTime()
    : null;
  return {
    ...base,
    all_day_date: null,
    start_at: start,
    end_at:
      durationMs === null ? null : toLocalIso(new Date(new Date(start).getTime() + durationMs)),
  };
}

/**
 * The tasks to show: every task except series rows, plus each series' unchanged days within the
 * day view's span (changed days are rows already, in `tasks`).
 */
export function withOccurrences(tasks: Task[], today = new Date()): Task[] {
  const todayKey = dateKey(today);
  const from = addDaysToKey(todayKey, -WINDOW_DAYS);
  const to = addDaysToKey(todayKey, WINDOW_DAYS);
  const stored = new Set(
    tasks.filter((t) => t.series_id).map((t) => `${t.series_id}:${t.occurrence_date}`),
  );
  virtualById.clear();
  const out: Task[] = [];
  for (const task of tasks) {
    if (!task.rrule) {
      out.push(task);
      continue;
    }
    const rule = parseRRule(task.rrule);
    const start = seriesStart(task);
    if (!rule || !start) continue;
    for (const day of occurrencesBetween(rule, start, from, to)) {
      if (stored.has(`${task.id}:${day}`)) continue;
      const v = virtualDay(task, day);
      virtualById.set(v.id, v);
      out.push(v);
    }
  }
  return out;
}

/** A task by id: the stored row, else a series' virtual day. */
export function getTask(id: string): Task | undefined {
  return taskTable.get(id) ?? virtualById.get(id);
}

/** Save a virtual day as its own row (no-op for stored tasks). */
export function materialize(id: string) {
  if (taskTable.get(id)) return;
  const v = virtualById.get(id);
  if (v) taskTable.insert({ ...v, updated_at: toLocalIso(new Date()) });
}

/** The changed days of a series that are stored as rows. */
export const storedDaysOf = (seriesId: string) =>
  taskTable.all().filter((t) => t.series_id === seriesId);
