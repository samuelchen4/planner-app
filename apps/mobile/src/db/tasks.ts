import {
  addDays,
  dateKey,
  DEFAULT_DURATION_MIN,
  isoAtMinutes,
  MINUTES_PER_DAY,
  minutesOfDay,
  parseDateKey,
  toLocalIso,
} from '@/features/day-view/time';

import { newId } from './ids';
import type { Task } from './schema';
import { habitDayTable, taskTable } from './tables';

// Everything the app does to tasks. Each action changes the in-memory table (the screens update
// at once) and the change is saved to the phone's database in the background.

const now = () => toLocalIso(new Date());
/** Until auth exists, every row belongs to this user. */
const USER_ID = 'me';

// ─── Reading ─────────────────────────────────────────────────────────────────────────────────

/** The task's day ('YYYY-MM-DD'), timed or all-day; null when it has no date. */
export function taskDay(task: Task): string | null {
  return task.start_at ? dateKey(new Date(task.start_at)) : task.all_day_date;
}

/** Start and end as minutes of the day, for a timed task. */
export function taskTimes(task: Task): { start: number; end: number } | null {
  if (!task.start_at) return null;
  const start = minutesOfDay(task.start_at);
  if (!task.end_at) return { start, end: start + DEFAULT_DURATION_MIN };
  // An end at the next midnight reads as 1440, not 0.
  const nextDay = dateKey(new Date(task.end_at)) !== dateKey(new Date(task.start_at));
  return { start, end: nextDay ? MINUTES_PER_DAY : minutesOfDay(task.end_at) };
}

/** A list's entries, in order. */
export function entriesOf(tasks: Task[], listId: string): Task[] {
  return tasks.filter((t) => t.list_id === listId);
}

// ─── Order ───────────────────────────────────────────────────────────────────────────────────

/** A position after every task. */
function lastPosition(): number {
  const all = taskTable.all();
  return all.length ? all[all.length - 1].position + 1 : 0;
}

/** A position just before `beforeId` (ignoring `movingId`, the task being placed). */
function positionBefore(beforeId: string, movingId: string): number {
  const others = taskTable.all().filter((t) => t.id !== movingId);
  const i = others.findIndex((t) => t.id === beforeId);
  if (i < 0) return lastPosition();
  const after = others[i].position;
  const before = i > 0 ? others[i - 1].position : after - 1;
  return (before + after) / 2;
}

// ─── Creating and deleting ───────────────────────────────────────────────────────────────────

/** What the add button makes, by page. */
export type NewTaskKind = 'task' | 'list' | 'habit';

/** A blank task with the given fields; not saved. */
function blankTask(fields: Partial<Task>): Task {
  const stamp = now();
  return {
    id: newId(),
    user_id: USER_ID,
    type: 'task',
    title: '',
    notes: null,
    start_at: null,
    end_at: null,
    time_zone: null,
    all_day_date: null,
    rrule: null,
    status: 'open',
    completed_at: null,
    list_id: null,
    color: null,
    icon: null,
    position: lastPosition(),
    created_at: stamp,
    updated_at: stamp,
    ...fields,
  };
}

/**
 * Make a new, untitled task (the details sheet then opens on it to name it) and return its id:
 * a task is all-day on `day`; a list is undated (Lists page only, until it gets a date); a habit
 * is daily, blue with a star until the user changes them.
 */
export function createTask(kind: NewTaskKind, day: Date): string {
  const task = blankTask({
    type: kind,
    ...(kind === 'task' && { all_day_date: dateKey(day) }),
    ...(kind === 'list' && { color: 'yellow' }),
    ...(kind === 'habit' && { color: 'blue', icon: 'star.fill' }),
  });
  taskTable.insert(task);
  return task.id;
}

/** Delete a task, with a list's entries and a habit's days. */
export function deleteTask(id: string) {
  taskTable.delete([id, ...entriesOf(taskTable.all(), id).map((t) => t.id)]);
  habitDayTable.delete(
    habitDayTable
      .all()
      .filter((d) => d.habit_id === id)
      .map((d) => d.id),
  );
}

/** Delete the task if it still has no title (a new one whose sheet closed without a name). */
export function deleteIfUntitled(id: string) {
  const task = taskTable.get(id);
  if (task && !task.title.trim()) deleteTask(id);
}

// ─── Changing ────────────────────────────────────────────────────────────────────────────────

/** Change some fields of a task. */
export function updateTask(id: string, patch: Partial<Task>) {
  taskTable.update(id, { ...patch, updated_at: now() });
}

/** Check a task off, or un-check it. */
export function toggleDone(id: string) {
  const task = taskTable.get(id);
  if (!task) return;
  const done = task.status !== 'done';
  updateTask(id, { status: done ? 'done' : 'open', completed_at: done ? now() : null });
}

/** Give an all-day task a time: `day` at `startMin`, lasting `durationMin`. */
export function scheduleTask(id: string, day: Date, startMin: number, durationMin: number) {
  const base = toLocalIso(day);
  updateTask(id, {
    start_at: isoAtMinutes(base, startMin),
    end_at: isoAtMinutes(base, startMin + durationMin),
    all_day_date: null,
  });
}

/** Move a timed task to `day` at `startMin`, keeping its duration. */
export function moveTask(id: string, day: Date, startMin: number) {
  const task = taskTable.get(id);
  const times = task && taskTimes(task);
  if (!times) return;
  const base = toLocalIso(day);
  updateTask(id, {
    start_at: isoAtMinutes(base, startMin),
    end_at: isoAtMinutes(base, startMin + (times.end - times.start)),
  });
}

/**
 * Make a task all-day on `day` (no time), placed just before `beforeId` in that day's list, or
 * last when null.
 */
export function unscheduleTask(id: string, day: Date, beforeId: string | null = null) {
  updateTask(id, {
    start_at: null,
    end_at: null,
    all_day_date: dateKey(day),
    position: beforeId ? positionBefore(beforeId, id) : lastPosition(),
  });
}

/**
 * Put the task on `day`, keeping its time if it has one (else it's all-day there). `null`
 * removes the date and the time (an undated task is in the inbox).
 */
export function setTaskDate(id: string, day: Date | null) {
  const task = taskTable.get(id);
  if (!task) return;
  if (!day) return updateTask(id, { start_at: null, end_at: null, all_day_date: null });
  const times = taskTimes(task);
  if (!times) return updateTask(id, { all_day_date: dateKey(day) });
  const base = toLocalIso(day);
  updateTask(id, {
    start_at: isoAtMinutes(base, times.start),
    end_at: isoAtMinutes(base, times.end),
  });
}

/** Shortest time the pickers allow. */
const MIN_SPAN = 15;

/**
 * Give the task a time on its day (today when it has no date). An end before the start is pushed
 * to MIN_SPAN after it; nothing runs past midnight.
 */
export function setTaskTime(id: string, start: number, end: number) {
  const task = taskTable.get(id);
  if (!task) return;
  const key = taskDay(task);
  const base = toLocalIso(key ? parseDateKey(key) : addDays(new Date(), 0));
  const s = Math.min(start, MINUTES_PER_DAY - MIN_SPAN);
  const e = Math.min(Math.max(end, s + MIN_SPAN), MINUTES_PER_DAY);
  updateTask(id, {
    start_at: isoAtMinutes(base, s),
    end_at: isoAtMinutes(base, e),
    all_day_date: null,
  });
}

/** Drop the time, keeping the day (it becomes all-day there). */
export function clearTaskTime(id: string) {
  const task = taskTable.get(id);
  if (!task?.start_at) return;
  updateTask(id, { start_at: null, end_at: null, all_day_date: dateKey(new Date(task.start_at)) });
}

// ─── A list's entries (edited in the details sheet) ──────────────────────────────────────────

/** A new, empty entry of `list`; not saved (the sheet edits entries locally, then saves them). */
export function newEntry(list: Task): Task {
  return blankTask({ list_id: list.id, user_id: list.user_id });
}

/**
 * Save the sheet's entries of `listId`, in their order: empty ones are dropped, removed ones
 * deleted, new ones added, changed ones updated. A plain task with entries becomes a list
 * (everything is a task; a list is a task with entries).
 */
export function saveEntries(listId: string, rows: Task[]) {
  const list = taskTable.get(listId);
  if (!list) return;
  const keep = rows.map((r) => ({ ...r, title: r.title.trim() })).filter((r) => r.title);
  const stored = new Map(entriesOf(taskTable.all(), listId).map((t) => [t.id, t]));

  taskTable.delete([...stored.keys()].filter((id) => !keep.some((r) => r.id === id)));

  // Keep stored positions where they're still in order; place the rest between their neighbours.
  let prev = -Infinity;
  keep.forEach((row, i) => {
    const old = stored.get(row.id);
    let position = old?.position;
    if (position === undefined || position <= prev) {
      const next = keep.slice(i + 1).find((r) => (stored.get(r.id)?.position ?? -Infinity) > prev);
      const nextPos = next && stored.get(next.id)?.position;
      position =
        prev === -Infinity
          ? (nextPos ?? lastPosition()) - 1
          : nextPos !== undefined
            ? (prev + nextPos) / 2
            : prev + 1;
    }
    prev = position;
    if (!old) taskTable.insert({ ...row, position, updated_at: now() });
    else if (
      old.title !== row.title ||
      old.status !== row.status ||
      old.completed_at !== row.completed_at ||
      old.position !== position
    ) {
      updateTask(row.id, {
        title: row.title,
        status: row.status,
        completed_at: row.completed_at,
        position,
      });
    }
  });

  if (list.type !== 'list' && keep.length) {
    updateTask(listId, { type: 'list', color: list.color ?? 'yellow' });
  }
}
