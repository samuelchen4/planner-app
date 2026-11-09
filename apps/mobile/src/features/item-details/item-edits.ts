import type { DayEntry, PlannerItem } from '@planner/core';

import {
  addDays,
  dateKey,
  isoAtMinutes,
  MINUTES_PER_DAY,
  minutesOfDay,
  parseDateKey,
  toLocalIso,
} from '@/features/day-view/time';

// Edits made from the item details sheet. Each takes the store's entries and returns new ones
// (pure, like the day view's helpers), so they slot straight into `setEntries(prev => …)`.

const now = () => toLocalIso(new Date());

/** A new item id. Generated on the device (works offline); the backend keeps whatever we send. */
export function newItemId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function findItem(entries: DayEntry[], id: string): PlannerItem | null {
  const e = entries.find((x) => x.kind === 'item' && x.item.id === id);
  return e?.kind === 'item' ? e.item : null;
}

/** What the add button makes, by page. */
export type NewItemKind = 'task' | 'list' | 'habit';

/**
 * A new, untitled item (the details sheet opens on it to name it): a task is an all-day task on
 * `day`; a list is undated (it lives on the Lists page until it gets a date); a habit is daily.
 */
export function createItem(
  entries: DayEntry[],
  kind: NewItemKind,
  id: string,
  userId: string,
  day: Date,
): DayEntry[] {
  const stamp = now();
  const item: PlannerItem = {
    id,
    userId,
    type: kind,
    title: '',
    status: 'open',
    createdAt: stamp,
    updatedAt: stamp,
    ...(kind === 'task' && { allDayDate: dateKey(day) }),
    ...(kind === 'list' && { color: 'yellow' as const }),
    ...(kind === 'habit' && { color: 'blue' as const, icon: 'star.fill' }),
  };
  return [...entries, { kind: 'item', item }];
}

/** Drop the item if it still has no title (a new item whose sheet was closed without naming it). */
export function discardIfUntitled(entries: DayEntry[], id: string): DayEntry[] {
  const item = findItem(entries, id);
  return item && !item.title.trim() ? removeItem(entries, id) : entries;
}

/** Change some fields of one planner item. */
export function updateItem(
  entries: DayEntry[],
  id: string,
  patch: Partial<PlannerItem>,
): DayEntry[] {
  return entries.map((e) =>
    e.kind === 'item' && e.item.id === id
      ? { ...e, item: { ...e.item, ...patch, updatedAt: now() } }
      : e,
  );
}

/** Delete a planner item (and, for a list, its entries). */
export function removeItem(entries: DayEntry[], id: string): DayEntry[] {
  return entries.filter((e) => e.kind !== 'item' || (e.item.id !== id && e.item.listId !== id));
}

/** The entries of a list, in order. */
export function subtasksOf(entries: DayEntry[], listId: string): PlannerItem[] {
  return entries.flatMap((e) => (e.kind === 'item' && e.item.listId === listId ? [e.item] : []));
}

/** A new, empty subtask of `parent` (not in the store yet: the sheet edits subtasks locally). */
export function newSubtask(parent: PlannerItem): PlannerItem {
  const stamp = now();
  return {
    id: newItemId(),
    userId: parent.userId,
    type: 'task',
    title: '',
    listId: parent.id,
    status: 'open',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/**
 * Write the sheet's subtasks of `parentId` back to the store: empty ones are dropped, the rest
 * replace the stored ones in their order (where the first stored one was, else at the end). A plain
 * task with subtasks becomes a list (everything is a task; a list is a task with entries). Returns
 * `entries` itself when nothing changed, so screens behind the sheet don't re-render.
 */
export function syncSubtasks(
  entries: DayEntry[],
  parentId: string,
  rows: PlannerItem[],
): DayEntry[] {
  const parent = findItem(entries, parentId);
  if (!parent) return entries;
  const keep = rows.map((r) => ({ ...r, title: r.title.trim() })).filter((r) => r.title !== '');
  const stored = subtasksOf(entries, parentId);
  const same =
    keep.length === stored.length &&
    keep.every((r, i) => {
      const s = stored[i];
      return s.id === r.id && s.title === r.title && s.status === r.status;
    });
  if (same) return entries;

  const stamp = now();
  const byId = new Map(stored.map((s) => [s.id, s]));
  const items: DayEntry[] = keep.map((r) => {
    const old = byId.get(r.id);
    const changed = !old || old.title !== r.title || old.status !== r.status;
    return { kind: 'item', item: changed ? { ...r, updatedAt: stamp } : old };
  });
  let at = entries.findIndex((e) => e.kind === 'item' && e.item.listId === parentId);
  const rest = entries.filter((e) => e.kind !== 'item' || e.item.listId !== parentId);
  if (at < 0) at = rest.length;
  const next = [...rest.slice(0, at), ...items, ...rest.slice(at)];
  return parent.type === 'list' || keep.length === 0
    ? next
    : updateItem(next, parentId, { type: 'list', color: parent.color ?? 'yellow' });
}

/** The item's day ('YYYY-MM-DD'), timed or all-day; null when it has no date. */
export function itemDayKey(item: PlannerItem): string | null {
  return item.startAt ? dateKey(new Date(item.startAt)) : (item.allDayDate ?? null);
}

/** Start/end as minutes of the day, for a timed item. */
export function itemTimes(item: PlannerItem): { start: number; end: number } | null {
  if (!item.startAt) return null;
  const start = minutesOfDay(item.startAt);
  if (!item.endAt) return { start, end: start + 30 };
  const endDate = new Date(item.endAt);
  // An end at the next midnight reads as 1440, not 0.
  const nextDay = dateKey(endDate) !== dateKey(new Date(item.startAt));
  return { start, end: nextDay ? MINUTES_PER_DAY : minutesOfDay(item.endAt) };
}

/**
 * Put the item on `day`, keeping its time if it has one (else it becomes an all-day item there).
 * `null` removes the date and the time (an undated task is in the inbox).
 */
export function setItemDate(entries: DayEntry[], id: string, day: Date | null): DayEntry[] {
  const item = findItem(entries, id);
  if (!item) return entries;
  if (!day)
    return updateItem(entries, id, { startAt: undefined, endAt: undefined, allDayDate: undefined });
  const times = itemTimes(item);
  if (!times) return updateItem(entries, id, { allDayDate: dateKey(day) });
  const base = toLocalIso(day);
  return updateItem(entries, id, {
    startAt: isoAtMinutes(base, times.start),
    endAt: isoAtMinutes(base, times.end),
  });
}

/** Shortest block the time pickers allow. */
const MIN_SPAN = 15;

/**
 * Give the item a time on its day (today when it has no date). Ends before the start are pushed
 * to MIN_SPAN after it; nothing runs past midnight.
 */
export function setItemTime(
  entries: DayEntry[],
  id: string,
  start: number,
  end: number,
): DayEntry[] {
  const item = findItem(entries, id);
  if (!item) return entries;
  const key = itemDayKey(item);
  const base = toLocalIso(key ? parseDateKey(key) : addDays(new Date(), 0));
  const s = Math.min(start, MINUTES_PER_DAY - MIN_SPAN);
  const e = Math.min(Math.max(end, s + MIN_SPAN), MINUTES_PER_DAY);
  return updateItem(entries, id, {
    startAt: isoAtMinutes(base, s),
    endAt: isoAtMinutes(base, e),
    allDayDate: undefined,
  });
}

/** Drop the time, keeping the day (the item becomes an all-day item there). */
export function clearItemTime(entries: DayEntry[], id: string): DayEntry[] {
  const item = findItem(entries, id);
  if (!item?.startAt) return entries;
  return updateItem(entries, id, {
    startAt: undefined,
    endAt: undefined,
    allDayDate: dateKey(new Date(item.startAt)),
  });
}
