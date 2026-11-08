import type { DayEntry, ListColor } from '@planner/core';

import { addDays, dateKey } from '@/features/day-view/time';

// Stand-in data until PowerSync lands, shaped like the planned tables. Lists are planner items
// (type 'list'); their entries are planner items with `listId` set (no times or dates).
const USER = 'me';
const CREATED = '2026-11-01T09:00:00-08:00';

/** Local 'YYYY-MM-DD' for today + offset days. */
const dayKey = (offset: number) => dateKey(addDays(new Date(), offset));

const list = (id: string, title: string, color: ListColor, allDayDate?: string): DayEntry => ({
  kind: 'item',
  item: {
    id,
    userId: USER,
    type: 'list',
    title,
    color,
    allDayDate,
    status: 'open',
    createdAt: CREATED,
    updatedAt: CREATED,
  },
});

const entry = (listId: string, id: string, title: string, done = false): DayEntry => ({
  kind: 'item',
  item: {
    id,
    userId: USER,
    type: 'task',
    title,
    listId,
    status: done ? 'done' : 'open',
    completedAt: done ? CREATED : undefined,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
});

export const mockListEntries: DayEntry[] = [
  // Groceries is on today (it shows in today's all-day tasks); Packing is in two days; Books has
  // no date, so it's only on the Lists page.
  list('list-1', 'Groceries', 'yellow', dayKey(0)),
  list('list-2', 'Packing for Tokyo', 'blue', dayKey(2)),
  list('list-3', 'Books to read', 'pink'),
  // Groceries: more than fit, so its note scrolls.
  entry('list-1', 'g-1', 'Oat milk'),
  entry('list-1', 'g-2', 'Eggs', true),
  entry('list-1', 'g-3', 'Spinach'),
  entry('list-1', 'g-4', 'Sourdough'),
  entry('list-1', 'g-5', 'Greek yogurt'),
  entry('list-1', 'g-6', 'Bananas', true),
  entry('list-1', 'g-7', 'Coffee beans'),
  entry('list-1', 'g-8', 'Chicken thighs'),
  entry('list-1', 'g-9', 'Lemons'),
  entry('list-1', 'g-10', 'Olive oil'),
  entry('list-2', 'p-1', 'Passport'),
  entry('list-2', 'p-2', 'Power adapter'),
  entry('list-2', 'p-3', 'Rain jacket', true),
  entry('list-2', 'p-4', 'Walking shoes'),
  entry('list-2', 'p-5', 'Suica card'),
  entry('list-3', 'b-1', 'The Remains of the Day'),
  entry('list-3', 'b-2', 'Piranesi', true),
  entry('list-3', 'b-3', 'Thinking in Systems'),
];
