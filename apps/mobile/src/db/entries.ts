import { useMemo } from 'react';

import type { ExternalEvent, Task } from './schema';
import { useTasks } from './tables';

/** What the day view and the details sheet show: a task, or a mirrored calendar event. */
export type DayEntry = { kind: 'item'; item: Task } | { kind: 'external'; event: ExternalEvent };

/** Every task and calendar event, as day entries (tasks in order). */
export function useDayEntries(): DayEntry[] {
  const tasks = useTasks();
  return useMemo(() => tasks.map((item): DayEntry => ({ kind: 'item', item })), [tasks]);
}
