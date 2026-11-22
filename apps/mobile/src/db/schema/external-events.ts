import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { calendarAccounts, calendars, CALENDAR_PROVIDERS } from './calendars';
import { day, timestamptz } from './columns';

export const EVENT_STATUSES = ['confirmed', 'tentative', 'cancelled'] as const;
/** Two-way state of a mirrored event (always 'synced' until phase 2/3). */
export const PUSH_STATES = ['synced', 'pending', 'conflict'] as const;

/**
 * Events mirrored from the user's selected calendars, read-only in the app. Only the backend's
 * calendar sync engine writes these. See notes/calendar-integrations.md.
 */
export const externalEvents = pgTable(
  'external_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** The owner (auth.users.id). */
    user_id: uuid().notNull(),
    account_id: uuid()
      .notNull()
      .references(() => calendarAccounts.id, { onDelete: 'cascade' }),
    calendar_id: uuid()
      .notNull()
      .references(() => calendars.id, { onDelete: 'cascade' }),
    /** Copied from the account, so it reads without a join. */
    provider: text({ enum: CALENDAR_PROVIDERS }).notNull(),
    /** The event's id at the provider. */
    external_id: text().notNull(),
    title: text().notNull().default(''),
    /** Shown as the event's notes. */
    description: text(),
    location: text(),
    /** Timed events (UTC), with the event's own IANA zone. */
    start_at: timestamptz(),
    end_at: timestamptz(),
    time_zone: text(),
    /** All-day events: first day, and the day after the last (exclusive, like the providers). */
    all_day_start: day(),
    all_day_end: day(),
    status: text({ enum: EVENT_STATUSES }).notNull().default('confirmed'),
    /** A repeating event's occurrence: the series it belongs to, and which occurrence it was. */
    series_id: text(),
    original_start_at: timestamptz(),
    /** Opens the event at the provider. */
    web_link: text(),
    /** The provider's version (etag). */
    version: text(),
    provider_updated_at: timestamptz(),
    push_state: text({ enum: PUSH_STATES }).notNull().default('synced'),
    updated_at: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('external_events_source_idx').on(t.calendar_id, t.external_id),
    index('external_events_user_idx').on(t.user_id),
  ],
);

export type ExternalEvent = typeof externalEvents.$inferSelect;
