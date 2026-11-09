import {
  SCHEDULE_MAX_END,
  SCHEDULE_MIN_SPAN,
  SCHEDULE_MIN_START,
} from '@planner/core';

import type { DayEntry } from '@/db/entries';

import {
  dateKey,
  DEFAULT_DURATION_MIN,
  MINUTES_PER_DAY,
  minutesOfDay,
} from './time';
import { MIN_BLOCK_MIN, type TimeWindow, type TimelineEntry } from './timeline-constants';

export interface AnytimeTask {
  id: string;
  title: string;
  done: boolean;
  /** A list (see TimelineEntry.isList). */
  isList: boolean;
  hasNotes: boolean;
}

/**
 * Entries grouped by local day ('YYYY-MM-DD'): timed ones for the grids, untimed planner tasks for
 * each day's Anytime list. An untimed task sits on its `all_day_date`; one with no date at all is in
 * the inbox, which shows as today's Anytime list. Lists are tasks too, but an undated list stays on
 * the Lists page (it isn't in the inbox); list entries never show here (they live in their list).
 */
export function bucketEntries(entries: DayEntry[], todayKey: string) {
  const timedByDay = new Map<string, TimelineEntry[]>();
  const anytimeByDay = new Map<string, AnytimeTask[]>();

  for (const e of entries) {
    const isItem = e.kind === 'item';
    const { id, title, start_at: startAt, end_at: endAt, status } = isItem ? e.item : e.event;
    if (status === 'cancelled') continue;
    if (isItem && e.item.list_id) continue;
    // Habits live on the Habits tab only.
    if (isItem && e.item.type === 'habit') continue;
    const isList = isItem && e.item.type === 'list';
    const hasNotes = isItem && !!e.item.notes?.trim();
    if (!startAt) {
      if (isItem) {
        if (isList && !e.item.all_day_date) continue;
        const key = e.item.all_day_date ?? todayKey;
        const list = anytimeByDay.get(key) ?? [];
        list.push({ id, title, done: status === 'done', isList, hasNotes });
        anytimeByDay.set(key, list);
      }
      continue;
    }
    const startMin = minutesOfDay(startAt);
    const endMin = endAt ? minutesOfDay(endAt) : startMin + DEFAULT_DURATION_MIN;
    const day = dateKey(new Date(startAt));
    const list = timedByDay.get(day) ?? [];
    list.push({
      id,
      title,
      startMin,
      // An end at or before the start means it runs past midnight: clip to the end of the day.
      endMin: endMin > startMin ? endMin : MINUTES_PER_DAY,
      draggable: isItem,
      tone: isItem ? 'planner' : 'calendar',
      checkable: isItem,
      done: status === 'done',
      isList,
      hasNotes,
    });
    timedByDay.set(day, list);
  }
  return { timedByDay, anytimeByDay };
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
