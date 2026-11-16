import { closeDatabase, openDatabase, watchRemoteChanges, writer } from './database';
import { LocalTable, useRows } from './local-table';
import { setOwner } from './owner';
import type { HabitDay, Task } from './schema';

/** Every row the app keeps on the device. */
export interface StoredRows {
  tasks: Task[];
  habitDays: HabitDay[];
}

/** All tasks, by position (then creation, for ties). */
export const taskTable = new LocalTable<Task>(
  'tasks',
  writer,
  (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
);

/** All habit days, by date. */
export const habitDayTable = new LocalTable<HabitDay>('habit_days', writer, (a, b) =>
  a.date.localeCompare(b.date),
);

let stopWatching = () => {};

export async function loadTables(userId: string) {
  setOwner(userId);
  let rows: StoredRows;
  try {
    rows = await openDatabase(userId);
  } catch (e) {
    console.warn('[db] Opening the database failed, running unsaved:', e);
    rows = { tasks: [], habitDays: [] };
  }
  taskTable.load(rows.tasks);
  habitDayTable.load(rows.habitDays);
  stopWatching();
  stopWatching = watchRemoteChanges((next) => {
    taskTable.replace(next.tasks);
    habitDayTable.replace(next.habitDays);
  });
}

export async function clearTables() {
  stopWatching();
  stopWatching = () => {};
  await closeDatabase();
  taskTable.load([]);
  habitDayTable.load([]);
}

export const useTasks = () => useRows(taskTable);
export const useHabitDays = () => useRows(habitDayTable);
