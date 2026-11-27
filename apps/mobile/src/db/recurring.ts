import { formatRRule, parseRRule, type Recurrence } from '@planner/core';

import { dateKey, toLocalIso } from '@/features/day-view/time';

import { newId } from './ids';
import { getTask, materialize, storedDaysOf } from './occurrences';
import type { Task } from './schema';
import { taskTable } from './tables';
import { clearTaskTime, setTaskTime, taskDay, updateTask } from './tasks';

// Recurring tasks (see occurrences for how their days are shown). What a change touches:
// - one day (check off, move, delete "this day", the date): that day's row (tasks.ts does it);
// - all days (title, notes, priority, the time when "all days" is picked, the rule): the series,
//   and the days already stored as rows, except checked-off/deleted ones for times.

const now = () => toLocalIso(new Date());

/** The series a task is a day of; null for a task that doesn't repeat. */
export function seriesOf(task: Task): Task | null {
  return task.series_id ? (taskTable.get(task.series_id) ?? null) : null;
}

/** A day's repeat rule and the day the series starts (for labels), or null. */
export function recurrenceOf(task: Task): { rule: Recurrence; start: string } | null {
  const series = seriesOf(task);
  const rule = series && parseRRule(series.rrule);
  const start = series && taskDay(series);
  return rule && start ? { rule, start } : null;
}

/**
 * Make `task` repeat by `rule`, starting on its day (today when it has none). A new series row
 * holds the rule; the task becomes its first day, so the open sheet stays on it.
 */
export function makeRecurring(task: Task, rule: Recurrence) {
  if (task.series_id) return setRecurrence(task, rule);
  if (!taskDay(task)) updateTask(task.id, { all_day_date: dateKey(new Date()) });
  const current = taskTable.get(task.id) ?? task;
  const day = taskDay(current)!;
  const stamp = now();
  const series: Task = {
    ...current,
    id: newId(),
    rrule: formatRRule(rule),
    series_id: null,
    occurrence_date: null,
    status: 'open',
    completed_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
  // The series is saved before the day that points at it (uploads go in order).
  taskTable.insert(series);
  updateTask(task.id, { series_id: series.id, occurrence_date: day });
}

/** Change the rule of the series `task` is a day of. Days already stored stay as they are. */
export function setRecurrence(task: Task, rule: Recurrence) {
  const series = seriesOf(task);
  if (series) updateTask(series.id, { rrule: formatRRule(rule) });
}

/**
 * Stop repeating: this day stays as a plain task, checked-off days stay as history, the series and
 * its other days go.
 */
export function stopRecurring(task: Task) {
  const series = seriesOf(task);
  if (!series) return;
  materialize(task.id);
  const detach = { series_id: null, occurrence_date: null };
  updateTask(task.id, detach);
  const drop: string[] = [];
  for (const day of storedDaysOf(series.id)) {
    if (day.id === task.id) continue;
    if (day.status === 'done') updateTask(day.id, detach);
    else drop.push(day.id);
  }
  // Detached rows are saved before the series is deleted (deleting it deletes its days).
  taskTable.delete([...drop, series.id]);
}

/** Title, notes, priority…: change them on the series and every stored day. */
export function updateAllDays(task: Task, patch: Partial<Task>) {
  const series = seriesOf(task);
  if (!series) return updateTask(task.id, patch);
  updateTask(series.id, patch);
  for (const day of storedDaysOf(series.id)) {
    if (day.status !== 'cancelled') updateTask(day.id, patch);
  }
}

const openDays = (seriesId: string) => storedDaysOf(seriesId).filter((d) => d.status === 'open');

/** Every day at `start`–`end` (minutes of the day): the series and the open stored days. */
export function setAllDaysTime(task: Task, start: number, end: number) {
  const series = seriesOf(task);
  if (!series) return setTaskTime(task.id, start, end);
  setTaskTime(series.id, start, end);
  for (const day of openDays(series.id)) setTaskTime(day.id, start, end);
  // This day too, when it's virtual (it then follows the series anyway) or checked off.
  if (taskTable.get(task.id)) setTaskTime(task.id, start, end);
}

/** Every day all-day (no time). */
export function clearAllDaysTime(task: Task) {
  const series = seriesOf(task);
  if (!series) return clearTaskTime(task.id);
  clearTaskTime(series.id);
  for (const day of openDays(series.id)) clearTaskTime(day.id);
  if (taskTable.get(task.id)) clearTaskTime(task.id);
}

/** Delete just this day: it's kept as a cancelled row, so the rule doesn't bring it back. */
export function deleteThisDay(id: string) {
  if (!getTask(id)) return;
  updateTask(id, { status: 'cancelled', completed_at: null });
}

/** Delete the whole series, every day included. */
export function deleteAllDays(task: Task) {
  const series = seriesOf(task);
  if (!series) return;
  taskTable.delete([...storedDaysOf(series.id).map((d) => d.id), series.id]);
}
