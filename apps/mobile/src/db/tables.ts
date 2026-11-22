import { closeDatabase, openDatabase, watchRemoteChanges, writer } from './database';
import { LocalTable, useRows } from './local-table';
import { setOwner } from './owner';
import type { Calendar, CalendarAccount, ExternalEvent, HabitDay, Task } from './schema';

/** Every row the app keeps on the device. */
export interface StoredRows {
  tasks: Task[];
  habitDays: HabitDay[];
  calendarAccounts: CalendarAccount[];
  calendars: Calendar[];
  externalEvents: ExternalEvent[];
}

export const emptyRows = (): StoredRows => ({
  tasks: [],
  habitDays: [],
  calendarAccounts: [],
  calendars: [],
  externalEvents: [],
});

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

/** Connected calendar accounts (written by the backend), oldest first. */
export const calendarAccountTable = new LocalTable<CalendarAccount>(
  'calendar_accounts',
  writer,
  (a, b) => a.created_at.localeCompare(b.created_at) || a.email.localeCompare(b.email),
);

/** Their calendars: primary first, then by name. The app only ever changes `is_selected`. */
export const calendarTable = new LocalTable<Calendar>(
  'calendars',
  writer,
  (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name),
);

/** Mirrored events (read-only; written by the backend), by start. */
export const externalEventTable = new LocalTable<ExternalEvent>(
  'external_events',
  writer,
  (a, b) =>
    (a.start_at ?? a.all_day_start ?? '').localeCompare(b.start_at ?? b.all_day_start ?? '') ||
    a.id.localeCompare(b.id),
);

let stopWatching = () => {};

export async function loadTables(userId: string) {
  setOwner(userId);
  let rows: StoredRows;
  try {
    rows = await openDatabase(userId);
  } catch (e) {
    console.warn('[db] Opening the database failed, running unsaved:', e);
    rows = emptyRows();
  }
  taskTable.load(rows.tasks);
  habitDayTable.load(rows.habitDays);
  calendarAccountTable.load(rows.calendarAccounts);
  calendarTable.load(rows.calendars);
  externalEventTable.load(rows.externalEvents);
  stopWatching();
  // Only the tables that changed are re-read and replaced.
  stopWatching = watchRemoteChanges((next) => {
    if (next.tasks) taskTable.replace(next.tasks);
    if (next.habitDays) habitDayTable.replace(next.habitDays);
    if (next.calendarAccounts) calendarAccountTable.replace(next.calendarAccounts);
    if (next.calendars) calendarTable.replace(next.calendars);
    if (next.externalEvents) externalEventTable.replace(next.externalEvents);
  });
}

export async function clearTables() {
  stopWatching();
  stopWatching = () => {};
  await closeDatabase();
  taskTable.load([]);
  habitDayTable.load([]);
  calendarAccountTable.load([]);
  calendarTable.load([]);
  externalEventTable.load([]);
}

export const useTasks = () => useRows(taskTable);
export const useHabitDays = () => useRows(habitDayTable);
export const useCalendarAccounts = () => useRows(calendarAccountTable);
export const useCalendars = () => useRows(calendarTable);
export const useExternalEvents = () => useRows(externalEventTable);
