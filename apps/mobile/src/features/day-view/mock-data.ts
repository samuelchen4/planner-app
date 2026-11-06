import type { DayEntry } from '@planner/core';

// Stand-in until PowerSync is wired up. Same shape as the planned tables,
// so swapping this for a live query later doesn't touch the UI.
const today = new Date().toISOString().slice(0, 10);
const at = (hhmm: string) => `${today}T${hhmm}:00`;
const now = new Date().toISOString();

export const mockDayEntries: DayEntry[] = [
  {
    kind: 'external',
    event: {
      id: 'ext-1',
      userId: 'me',
      calendarId: 'work',
      provider: 'google',
      externalId: 'g-123',
      title: 'Team standup',
      startAt: at('09:00'),
      endAt: at('09:15'),
      status: 'confirmed',
      updatedAt: now,
    },
  },
  {
    kind: 'item',
    item: {
      id: 'item-1',
      userId: 'me',
      type: 'time_block',
      title: 'Deep work',
      startAt: at('09:30'),
      endAt: at('11:30'),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    },
  },
  {
    kind: 'item',
    item: {
      id: 'item-2',
      userId: 'me',
      type: 'task',
      title: 'Reply to accountant',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    },
  },
];
