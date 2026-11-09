import { addDays, dateKey, isoAtMinutes, toLocalIso } from '@/features/day-view/time';

import type { ExternalEvent, HabitDay, Task, TaskColor } from './schema';
import type { StoredRows } from './tables';

// Sample data, written to the phone's database on first launch (and used as-is on the web), so
// the app has something in it before the backend exists. Times are relative to when it's made.
// It must be wiped before syncing to a server: its ids aren't uuids.

const USER = 'me';

/** Days and times relative to today: '09:30' = today 9:30; '+1 09:30' = tomorrow; '-1 18:00'. */
function at(when: string): string {
  const [offset, hhmm] = when.includes(' ') ? when.split(' ') : ['0', when];
  const [h, m] = hhmm.split(':').map(Number);
  return isoAtMinutes(toLocalIso(new Date()), Number(offset) * 24 * 60 + h * 60 + m);
}
const dayFromToday = (offset: number) => dateKey(addDays(new Date(), offset));

/** Every sample task starts from this, then overrides what it needs. */
function task(id: string, title: string, fields: Partial<Task> = {}): Task {
  const now = toLocalIso(new Date());
  return {
    id,
    user_id: USER,
    type: 'task',
    title,
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
    position: 0,
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

const timed = (id: string, title: string, start: string, end: string, block = false) =>
  task(id, title, { type: block ? 'time_block' : 'task', start_at: at(start), end_at: at(end) });

const list = (id: string, title: string, color: TaskColor, date?: string) =>
  task(id, title, { type: 'list', color, all_day_date: date ?? null });

const entry = (listId: string, id: string, title: string, done = false) =>
  task(id, title, {
    list_id: listId,
    status: done ? 'done' : 'open',
    completed_at: done ? toLocalIso(new Date()) : null,
  });

const habit = (id: string, title: string, color: TaskColor, icon: string) =>
  task(id, title, { type: 'habit', color, icon });

function sampleTasks(): Task[] {
  const rows = [
    // Today
    timed('item-1', 'Deep work', '09:30', '11:30', true),
    timed('item-3', 'Review pull requests', '14:00', '14:45'),
    timed('item-4', 'Gym', '17:30', '18:30', true),
    task('item-2', 'Reply to accountant'), // no date: the inbox, shown on today
    // Neighbouring days, so scrolling past midnight shows something.
    timed('item-5', 'Groceries', '-1 18:00', '-1 18:45'),
    timed('item-6', 'Plan the week', '+1 08:30', '+1 09:30', true),
    timed('item-7', 'Long run', '+1 06:00', '+1 07:00', true),
    task('item-8', 'Call the bank', { all_day_date: dayFromToday(1) }),

    // Lists: Groceries is on today, Packing in two days, Books has no date (Lists page only).
    list('list-1', 'Groceries', 'yellow', dayFromToday(0)),
    list('list-2', 'Packing for Tokyo', 'blue', dayFromToday(2)),
    list('list-3', 'Books to read', 'pink'),
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

    // Habits
    habit('habit-1', 'Drink 2L of water', 'blue', 'drop.fill'),
    habit('habit-2', 'Read 20 minutes', 'lavender', 'book.fill'),
    habit('habit-3', 'Stretch', 'orange', 'figure.flexibility'),
    habit('habit-4', 'No phone after 10 PM', 'pink', 'iphone.slash'),
  ];
  // In the order above.
  return rows.map((row, i) => ({ ...row, position: i }));
}

function sampleHabitDays(): HabitDay[] {
  /** Days ago each habit was done (0 = today), and a few notes. */
  const done: Record<string, number[]> = {
    'habit-1': [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11],
    'habit-2': [1, 2, 3, 5, 6, 9],
    'habit-3': [0, 2, 4, 7],
    'habit-4': [],
  };
  const notes: Record<string, Record<number, string>> = {
    'habit-1': { 1: 'Hard in the afternoon, kept a bottle at my desk.' },
    'habit-2': { 1: 'Piranesi, chapters 4–5.', 4: 'Skipped, too tired.' },
  };
  const now = toLocalIso(new Date());
  return Object.keys(done).flatMap((habitId) => {
    const days = new Set([...done[habitId], ...Object.keys(notes[habitId] ?? {}).map(Number)]);
    return [...days].map((ago) => {
      const date = dayFromToday(-ago);
      return {
        id: `${habitId}:${date}`,
        habit_id: habitId,
        user_id: USER,
        date,
        done_at: done[habitId].includes(ago) ? now : null,
        note: notes[habitId]?.[ago] ?? null,
        updated_at: now,
      };
    });
  });
}

export function sampleRows(): StoredRows {
  return { tasks: sampleTasks(), habitDays: sampleHabitDays() };
}

/** Sample Google Calendar events. Kept in memory: only the server writes real ones. */
export function sampleEvents(): ExternalEvent[] {
  const event = (id: string, title: string, start: string, end: string): ExternalEvent => ({
    id,
    user_id: USER,
    provider: 'google',
    calendar_id: 'work',
    external_id: `g-${id}`,
    title,
    location: null,
    start_at: at(start),
    end_at: at(end),
    time_zone: null,
    all_day_start: null,
    all_day_end: null,
    status: 'confirmed',
    updated_at: toLocalIso(new Date()),
  });
  return [
    event('ext-1', 'Team standup', '09:00', '09:15'),
    event('ext-2', 'Lunch with Priya', '12:30', '13:30'),
    event('ext-3', 'Design sync', '14:30', '15:30'),
    event('ext-4', 'Dinner with Sam', '-1 19:30', '-1 21:00'),
    event('ext-5', 'Dentist', '+1 10:00', '+1 11:00'),
  ];
}
