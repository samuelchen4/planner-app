import { SCHEDULE_MAX_END, SCHEDULE_MIN_SPAN, SCHEDULE_MIN_START } from '@planner/core';

import type { DayEntry } from '@/db/entries';
import { priorityOf } from '@/db/tasks';

import { placeEvent } from './event-days';
import { formatTime, MINUTES_PER_DAY, minutesOfDay } from './time';
import { MIN_BLOCK_MIN, type TimeWindow, type TimelineEntry } from './timeline-constants';

export interface AnytimeTask {
  id: string;
  title: string;
  done: boolean;
  /** A list (see TimelineEntry.isList). */
  isList: boolean;
  hasNotes: boolean;
  /** 0 = none, 1–3: drawn with that level's border. */
  priority: number;
  /** A day of a recurring task: drawn with a repeat icon by its title. */
  isRecurring: boolean;
}

/** A calendar event in a day's all-day area (read-only: no check, can't be dragged). */
export interface AllDayEvent {
  id: string;
  title: string;
  /** Its calendar's colour (hex), or null for the neutral grey. */
  color: string | null;
}

/** '9:30 AM – 10:00 AM' for an event's own start and end (local time). */
function eventTimeLabel(startAt: string, endAt: string | null): string {
  const start = formatTime(minutesOfDay(startAt));
  return endAt ? `${start} – ${formatTime(minutesOfDay(endAt))}` : start;
}

/**
 * Entries grouped by local day ('YYYY-MM-DD'): timed ones for the grids, untimed planner tasks for
 * each day's Anytime list. An untimed task sits on its `all_day_date`; one with no date at all is in
 * the inbox, which shows as today's Anytime list. Lists are tasks too, but an undated list stays on
 * the Lists page (it isn't in the inbox); list entries never show here (they live in their list).
 * Calendar events (see placeEvent): timed ones on every day they touch, split at midnight; all-day
 * (and day-long) ones in `allDayEventsByDay`, on every day they cover.
 */
export function bucketEntries(entries: DayEntry[], todayKey: string) {
  const timedByDay = new Map<string, TimelineEntry[]>();
  const anytimeByDay = new Map<string, AnytimeTask[]>();
  const allDayEventsByDay = new Map<string, AllDayEvent[]>();
  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const e of entries) {
    if (e.kind === 'external') {
      const { event } = e;
      if (event.status === 'cancelled') continue;
      const color = e.calendar?.color ?? null;
      const title = event.title.trim() || '(No title)';
      const placement = placeEvent(event);
      if (placement.kind === 'allDay') {
        for (const day of placement.days) {
          push(allDayEventsByDay, day, { id: event.id, title, color });
        }
      } else if (placement.kind === 'timed' && event.start_at) {
        const timeLabel = eventTimeLabel(event.start_at, event.end_at);
        for (const seg of placement.segments) {
          push(timedByDay, seg.day, {
            id: event.id,
            title,
            startMin: seg.startMin,
            endMin: seg.endMin,
            draggable: false,
            tone: 'calendar',
            checkable: false,
            done: false,
            isList: false,
            hasNotes: false,
            color,
            timeLabel,
          });
        }
      }
      continue;
    }
    const { item } = e;
    const { id, title, start_at: startAt, end_at: endAt, status } = item;
    if (status === 'cancelled') continue;
    if (item.list_id) continue;
    // Habits live on the Habits tab only.
    if (item.type === 'habit') continue;
    const isList = item.type === 'list';
    const hasNotes = !!item.notes?.trim();
    const priority = priorityOf(item);
    const isRecurring = !!item.series_id;
    if (!startAt) {
      if (isList && !item.all_day_date) continue;
      push(anytimeByDay, item.all_day_date ?? todayKey, {
        id,
        title,
        done: status === 'done',
        isList,
        hasNotes,
        priority,
        isRecurring,
      });
      continue;
    }
    // One block per day it touches (like calendar events): 9:15 PM – 1:00 AM is 9:15 PM to
    // midnight on its day and midnight to 1:00 AM on the next, both labelled with its full times.
    const placement = placeEvent({
      start_at: startAt,
      end_at: endAt,
      all_day_start: null,
      all_day_end: null,
    });
    if (placement.kind !== 'timed') continue;
    const segments = placement.segments;
    const timeLabel = segments.length > 1 ? eventTimeLabel(startAt, endAt) : undefined;
    const firstStart = segments[0]?.startMin ?? 0;
    segments.forEach((seg, i) => {
      push(timedByDay, seg.day, {
        id,
        title,
        startMin: seg.startMin,
        endMin: seg.endMin,
        // Later pieces start at midnight: how far into the task that is, so a drag moves the task.
        offsetMin: i === 0 ? 0 : MINUTES_PER_DAY - firstStart + (i - 1) * MINUTES_PER_DAY,
        draggable: true,
        tone: 'planner',
        checkable: true,
        done: status === 'done',
        isList,
        hasNotes,
        priority,
        isRecurring,
        timeLabel,
      });
    });
  }
  return { timedByDay, anytimeByDay, allDayEventsByDay };
}

/**
 * What a day's grid shows: just its events, first start to last end, never past
 * 12:01 AM – 11:59 PM (null when there are none, so the day shows "Nothing scheduled"). Today
 * included: no open space around the day's tasks.
 */
export function dayWindow(entries: TimelineEntry[]): TimeWindow | null {
  const bounds = contentBounds(entries);
  return bounds && clampWindow(bounds.first, bounds.last);
}

export type Edge = 'top' | 'bottom';

/**
 * A day's manual edges, set by dragging its edge handles (either way: grow or shrink). They only
 * last until that day's timed tasks change; then the grid hugs its tasks again (see DayCanvas).
 */
export interface WindowStretch {
  startMin?: number;
  endMin?: number;
}

/** First start and last (drawn) end of a day's events; null when there are none. */
export type ContentBounds = { first: number; last: number } | null;

export function contentBounds(entries: TimelineEntry[]): ContentBounds {
  if (entries.length === 0) return null;
  let first = Infinity;
  let last = -Infinity;
  for (const e of entries) {
    first = Math.min(first, e.startMin);
    last = Math.max(last, e.endMin, e.startMin + MIN_BLOCK_MIN);
  }
  return { first, last };
}

/** The natural window with any manual edges applied. Events always stay inside it. */
export function applyStretch(
  base: TimeWindow,
  stretch: WindowStretch | undefined,
  bounds: ContentBounds,
): TimeWindow {
  if (!stretch) return base;
  let startMin = stretch.startMin ?? base.startMin;
  let endMin = stretch.endMin ?? base.endMin;
  if (bounds) {
    startMin = Math.min(startMin, bounds.first);
    endMin = Math.max(endMin, bounds.last);
  }
  return clampWindow(startMin, endMin);
}

/**
 * Where an edge may be dragged, as [min, max] minutes. Outward: as far as 12:01 AM / 11:59 PM.
 * Inward: up to the first (or last) event it reaches; with no events, until an hour is left.
 */
export function edgeRange(edge: Edge, w: TimeWindow, bounds: ContentBounds): [number, number] {
  if (edge === 'top') {
    const inner = bounds ? bounds.first : w.endMin - SCHEDULE_MIN_SPAN;
    return [SCHEDULE_MIN_START, Math.max(SCHEDULE_MIN_START, inner)];
  }
  const inner = bounds ? bounds.last : w.startMin + SCHEDULE_MIN_SPAN;
  return [Math.min(SCHEDULE_MAX_END, inner), SCHEDULE_MAX_END];
}

const clampWindow = (startMin: number, endMin: number): TimeWindow => ({
  startMin: Math.max(SCHEDULE_MIN_START, startMin),
  endMin: Math.min(SCHEDULE_MAX_END, endMin),
});
