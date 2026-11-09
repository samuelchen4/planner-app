import { useMemo } from 'react';

import { sampleEvents } from './sample-data';
import type { ExternalEvent, Task } from './schema';
import { useTasks } from './tables';

/** What the day view and the details sheet show: a task, or a mirrored calendar event. */
export type DayEntry = { kind: 'item'; item: Task } | { kind: 'external'; event: ExternalEvent };

/** Sample Google events, until the backend's calendar sync fills the external_events table. */
const events = sampleEvents().map((event): DayEntry => ({ kind: 'external', event }));

/** Every task and calendar event, as day entries (tasks in order). */
export function useDayEntries(): DayEntry[] {
  const tasks = useTasks();
  return useMemo(
    () => [...tasks.map((item): DayEntry => ({ kind: 'item', item })), ...events],
    [tasks],
  );
}
