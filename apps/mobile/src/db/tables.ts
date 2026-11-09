import { openDatabase, writer } from './database';
import { LocalTable, useRows } from './local-table';
import { sampleRows } from './sample-data';
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

/**
 * Open the database and fill the tables (sample data on first launch). Call once at startup. If
 * the database can't open, the app still runs on the sample data (unsaved).
 */
export async function loadTables() {
  let rows: StoredRows;
  try {
    rows = await openDatabase(sampleRows);
  } catch (e) {
    console.warn('[db] Opening the database failed, using unsaved sample data:', e);
    rows = sampleRows();
  }
  taskTable.load(rows.tasks);
  habitDayTable.load(rows.habitDays);
}

export const useTasks = () => useRows(taskTable);
export const useHabitDays = () => useRows(habitDayTable);
