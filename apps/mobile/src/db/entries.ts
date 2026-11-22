import { useMemo } from 'react';

import type { Calendar, CalendarAccount, ExternalEvent, Task } from './schema';
import { useCalendarAccounts, useCalendars, useExternalEvents, useTasks } from './tables';

/** A mirrored calendar event with where it comes from (for its colour and the details sheet). */
export interface ExternalEntry {
  kind: 'external';
  event: ExternalEvent;
  calendar: Calendar | undefined;
  account: CalendarAccount | undefined;
}

/** What the day view and the details sheet show: a task, or a mirrored calendar event. */
export type DayEntry = { kind: 'item'; item: Task } | ExternalEntry;

/** The id of what an entry shows (a task's or an event's). */
export const entryId = (e: DayEntry) => (e.kind === 'item' ? e.item.id : e.event.id);

/**
 * Calendar events worth showing: from a selected calendar (switching one off hides its events
 * at once, before the server deletes them), never the Planner calendar, never cancelled.
 */
export function externalEntries(
  events: ExternalEvent[],
  calendars: Calendar[],
  accounts: CalendarAccount[],
): ExternalEntry[] {
  const calendarById = new Map(calendars.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const out: ExternalEntry[] = [];
  for (const event of events) {
    if (event.status === 'cancelled') continue;
    const calendar = calendarById.get(event.calendar_id);
    if (calendar && (!calendar.is_selected || calendar.is_planner_calendar)) continue;
    out.push({ kind: 'external', event, calendar, account: accountById.get(event.account_id) });
  }
  return out;
}

/** Every task and calendar event, as day entries (tasks in order, then events by start). */
export function useDayEntries(): DayEntry[] {
  const tasks = useTasks();
  const events = useExternalEvents();
  const calendars = useCalendars();
  const accounts = useCalendarAccounts();
  return useMemo(
    () => [
      ...tasks.map((item): DayEntry => ({ kind: 'item', item })),
      ...externalEntries(events, calendars, accounts),
    ],
    [tasks, events, calendars, accounts],
  );
}
