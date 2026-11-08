// Draft data model shared by mobile, web and (via generated DB types later) the backend.
// See notes/ for the design: our own items live in planner_items; Google (and later other
// providers) are mirrored read-only into external_events. The day view merges both.

/** ISO-8601 timestamp with offset, e.g. '2026-11-05T09:00:00-08:00' */
export type IsoDateTime = string;
/** Calendar date, e.g. '2026-11-05' (used for all-day items) */
export type IsoDate = string;

/**
 * Everything the user makes is a planner item. A 'list' is an item too (it can be dated, timed and
 * moved like any task); its entries are items with `listId` pointing at it.
 */
export type PlannerItemType = 'task' | 'time_block' | 'habit' | 'note' | 'list';

/** Something the user created in this app. We own the shape. */
export interface PlannerItem {
  id: string; // UUID, generated on the device so it works offline
  userId: string;
  type: PlannerItemType;
  title: string;
  notes?: string;
  /** Timed items: start/end + the IANA zone they were created in */
  startAt?: IsoDateTime;
  endAt?: IsoDateTime;
  timeZone?: string;
  /** All-day items */
  allDayDate?: IsoDate;
  /** RFC 5545 recurrence rule, e.g. 'FREQ=WEEKLY;BYDAY=MO,WE' */
  rrule?: string;
  status: 'open' | 'done' | 'cancelled';
  /** When it was checked off (set together with status 'done'). */
  completedAt?: IsoDateTime;
  /** An entry of a list: the list item's id. List entries have no times or dates of their own. */
  listId?: string;
  /** Lists only: their sticky-note colour (a key of the UI's `noteColors`). */
  color?: ListColor;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Sticky-note colours a list can take (green is reserved for done). */
export type ListColor = 'yellow' | 'pink' | 'blue' | 'orange' | 'lavender';

export type CalendarProvider = 'google';

/** Read-only mirror of an event from an external calendar. Written only by the sync worker. */
export interface ExternalEvent {
  id: string;
  userId: string;
  calendarId: string;
  provider: CalendarProvider;
  externalId: string;
  title: string;
  location?: string;
  startAt?: IsoDateTime;
  endAt?: IsoDateTime;
  timeZone?: string;
  allDayStart?: IsoDate;
  allDayEnd?: IsoDate; // exclusive, matching Google's convention
  status: 'confirmed' | 'tentative' | 'cancelled';
  updatedAt: IsoDateTime;
}

/** What the day view renders: either kind, tagged. */
export type DayEntry =
  { kind: 'item'; item: PlannerItem } | { kind: 'external'; event: ExternalEvent };
