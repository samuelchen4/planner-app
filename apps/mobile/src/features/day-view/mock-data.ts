import type { DayEntry, ExternalEvent, PlannerItem } from '@planner/core';

import { isoAtMinutes, toLocalIso } from './time';

// Stand-in until PowerSync is wired up. Same shape as the planned tables,
// so swapping this for a live query later doesn't touch the UI.
const now = toLocalIso(new Date());
/** '09:30' = today at 9:30; '+1 09:30' = tomorrow; '-1 18:00' = yesterday. */
const at = (when: string) => {
  const [dayOffset, hhmm] = when.includes(' ') ? when.split(' ') : ['0', when];
  const [h, m] = hhmm.split(':').map(Number);
  return isoAtMinutes(now, Number(dayOffset) * 24 * 60 + h * 60 + m);
};

const item = (
  id: string,
  type: PlannerItem['type'],
  title: string,
  start?: string,
  end?: string,
): DayEntry => ({
  kind: 'item',
  item: {
    id,
    userId: 'me',
    type,
    title,
    startAt: start && at(start),
    endAt: end && at(end),
    status: 'open',
    createdAt: now,
    updatedAt: now,
  },
});

const google = (id: string, title: string, start: string, end: string): DayEntry => {
  const event: ExternalEvent = {
    id,
    userId: 'me',
    calendarId: 'work',
    provider: 'google',
    externalId: `g-${id}`,
    title,
    startAt: at(start),
    endAt: at(end),
    status: 'confirmed',
    updatedAt: now,
  };
  return { kind: 'external', event };
};

export const mockDayEntries: DayEntry[] = [
  google('ext-1', 'Team standup', '09:00', '09:15'),
  item('item-1', 'time_block', 'Deep work', '09:30', '11:30'),
  google('ext-2', 'Lunch with Priya', '12:30', '13:30'),
  item('item-3', 'task', 'Review pull requests', '14:00', '14:45'),
  google('ext-3', 'Design sync', '14:30', '15:30'),
  item('item-4', 'time_block', 'Gym', '17:30', '18:30'),
  item('item-2', 'task', 'Reply to accountant'),
  // Neighbouring days, so scrolling past midnight shows something.
  item('item-5', 'task', 'Groceries', '-1 18:00', '-1 18:45'),
  google('ext-4', 'Dinner with Sam', '-1 19:30', '-1 21:00'),
  item('item-6', 'time_block', 'Plan the week', '+1 08:30', '+1 09:30'),
  google('ext-5', 'Dentist', '+1 10:00', '+1 11:00'),
  // Before the default 7 AM start: tomorrow's grid stretches up to 6 AM to fit it.
  item('item-7', 'time_block', 'Long run', '+1 06:00', '+1 07:00'),
];
