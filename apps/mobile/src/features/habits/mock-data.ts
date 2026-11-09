import type { DayEntry, HabitDay, ListColor } from '@planner/core';

import { addDays, dateKey } from '@/features/day-view/time';

// Stand-in data until PowerSync lands, shaped like the planned tables: habits are planner items
// (type 'habit'), their history is a log of checked days.
const USER = 'me';
const CREATED = '2026-10-01T09:00:00-08:00';

const habit = (id: string, title: string, color: ListColor, icon: string): DayEntry => ({
  kind: 'item',
  item: {
    id,
    userId: USER,
    type: 'habit',
    title,
    color,
    icon,
    status: 'open',
    createdAt: CREATED,
    updatedAt: CREATED,
  },
});

export const mockHabits: DayEntry[] = [
  habit('habit-1', 'Drink 2L of water', 'blue', 'drop.fill'),
  habit('habit-2', 'Read 20 minutes', 'lavender', 'book.fill'),
  habit('habit-3', 'Stretch', 'orange', 'figure.flexibility'),
  habit('habit-4', 'No phone after 10 PM', 'pink', 'iphone.slash'),
];

/** Days ago each habit was done (0 = today). */
const history: Record<string, number[]> = {
  'habit-1': [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11],
  'habit-2': [1, 2, 3, 5, 6, 9],
  'habit-3': [0, 2, 4, 7],
  'habit-4': [],
};

/** A few notes, by habit and days ago. */
const notes: Record<string, Record<number, string>> = {
  'habit-1': { 1: 'Hard in the afternoon, kept a bottle at my desk.' },
  'habit-2': { 1: 'Piranesi, chapters 4–5.', 4: 'Skipped, too tired.' },
};

export const mockHabitDays: HabitDay[] = Object.keys(history).flatMap((habitId) => {
  const days = new Set([...history[habitId], ...Object.keys(notes[habitId] ?? {}).map(Number)]);
  return [...days].map((n) => ({
    habitId,
    userId: USER,
    date: dateKey(addDays(new Date(), -n)),
    done: history[habitId].includes(n),
    note: notes[habitId]?.[n],
    updatedAt: CREATED,
  }));
});
