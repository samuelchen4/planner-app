import { calendarTable } from './tables';

// Calendar actions. Accounts, calendars and events are written by the backend; the only change the
// app makes is switching a calendar on or off.

/**
 * Show (or stop showing) a calendar's events. Its events hide at once (useDayEntries filters on
 * `is_selected`); the change uploads as a PATCH of `is_selected` (see upload-batch.ts), and the
 * backend then imports the calendar's events, or deletes them.
 */
export function setCalendarSelected(id: string, selected: boolean) {
  const calendar = calendarTable.get(id);
  if (!calendar || calendar.is_selected === selected) return;
  calendarTable.update(id, { is_selected: selected });
}
