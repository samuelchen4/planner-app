import {
  SCHEDULE_MAX_END,
  SCHEDULE_MIN_SPAN,
  SCHEDULE_MIN_START,
  type DayEntry,
  type ScheduleSettings,
} from '@planner/core';

import {
  dateKey,
  DEFAULT_DURATION_MIN,
  isoAtMinutes,
  MINUTES_PER_DAY,
  minutesOfDay,
  toLocalIso,
} from './time';
import { MIN_BLOCK_MIN, type TimeWindow, type TimelineEntry } from './timeline-constants';

export interface AnytimeTask {
  id: string;
  title: string;
}

/**
 * Timed entries grouped by local day ('YYYY-MM-DD'). Untimed tasks have no date yet, so they act
 * as today's inbox (the "Anytime" list).
 */
export function bucketEntries(entries: DayEntry[]) {
  const timedByDay = new Map<string, TimelineEntry[]>();
  const anytime: AnytimeTask[] = [];

  for (const e of entries) {
    const isItem = e.kind === 'item';
    const { id, title, startAt, endAt, status } = isItem ? e.item : e.event;
    if (status === 'cancelled') continue;
    if (!startAt) {
      if (isItem) anytime.push({ id, title });
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
    });
    timedByDay.set(day, list);
  }
  return { timedByDay, anytime };
}

/**
 * What a day's grid shows, never past 12:01 AM – 11:59 PM:
 * - today: at least the configured default window, stretched to whole hours to fit anything outside it;
 * - other days: just their events, first start to last end (null when there are none).
 */
export function dayWindow(
  entries: TimelineEntry[],
  schedule: ScheduleSettings,
  isToday: boolean,
): TimeWindow | null {
  if (isToday) {
    let startMin = schedule.dayStartMin;
    let endMin = schedule.dayEndMin;
    for (const e of entries) {
      startMin = Math.min(startMin, Math.floor(e.startMin / 60) * 60);
      endMin = Math.max(endMin, Math.ceil(e.endMin / 60) * 60);
    }
    return clampWindow(startMin, endMin);
  }

  // Other days are compact: first event's start to the end of the last one. Nothing scheduled: no grid.
  if (entries.length === 0) return null;
  let startMin = Infinity;
  let endMin = -Infinity;
  for (const e of entries) {
    startMin = Math.min(startMin, e.startMin);
    // Short blocks are drawn MIN_BLOCK_MIN tall; make room for that so they aren't cut off.
    endMin = Math.max(endMin, e.endMin, e.startMin + MIN_BLOCK_MIN);
  }
  return clampWindow(startMin, endMin);
}

export type Edge = 'top' | 'bottom';

/** A day's manual edges, set by dragging its edge handles (either way: grow or shrink). */
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

/** Move a timed planner item to a new start on the same day, keeping its duration. */
export function moveItem(entries: DayEntry[], id: string, startMin: number): DayEntry[] {
  return entries.map((e) => {
    if (e.kind !== 'item' || e.item.id !== id || !e.item.startAt) return e;
    const { startAt, endAt } = e.item;
    const oldStart = minutesOfDay(startAt);
    const duration = endAt ? minutesOfDay(endAt) - oldStart : DEFAULT_DURATION_MIN;
    return {
      ...e,
      item: {
        ...e.item,
        startAt: isoAtMinutes(startAt, startMin),
        endAt: isoAtMinutes(startAt, startMin + duration),
        updatedAt: toLocalIso(new Date()),
      },
    };
  });
}
