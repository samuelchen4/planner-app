import { boolean, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamptz } from './columns';

/** Calendar providers the backend has an adapter for (planner-backend constants.ts). */
export const CALENDAR_PROVIDERS = ['google', 'microsoft'] as const;
export const ACCOUNT_STATUSES = ['active', 'needs_reconnect', 'revoked'] as const;
/** What the user may do in a calendar. */
export const ACCESS_ROLES = ['owner', 'writer', 'reader', 'freeBusyReader'] as const;

/**
 * A connected calendar account (a Google account, …). Written only by the backend; devices get
 * just these display columns (the backend table also has the provider's account id and scopes,
 * and the login lives in a server-only table).
 */
export const calendarAccounts = pgTable(
  'calendar_accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** The owner (auth.users.id). */
    user_id: uuid().notNull(),
    provider: text({ enum: CALENDAR_PROVIDERS }).notNull(),
    email: text().notNull(),
    status: text({ enum: ACCOUNT_STATUSES }).notNull().default('active'),
    created_at: timestamptz().notNull().defaultNow(),
    updated_at: timestamptz().notNull().defaultNow(),
  },
  (t) => [index('calendar_accounts_user_idx').on(t.user_id)],
);

/**
 * A calendar in a connected account. Written by the backend; the app only switches `is_selected`
 * (the only change /sync/upload accepts here). Selected calendars are mirrored into
 * external_events. Booleans arrive from SQLite as 0/1; the app's copy normalises them (tables.ts).
 */
export const calendars = pgTable(
  'calendars',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** The owner (auth.users.id). */
    user_id: uuid().notNull(),
    account_id: uuid()
      .notNull()
      .references(() => calendarAccounts.id, { onDelete: 'cascade' }),
    /** The calendar's id at the provider (e.g. 'samuel@gmail.com'). */
    provider_calendar_id: text().notNull(),
    name: text().notNull().default(''),
    /** Hex colour from the provider. */
    color: text(),
    is_primary: boolean().notNull().default(false),
    access_role: text({ enum: ACCESS_ROLES }).notNull().default('reader'),
    is_selected: boolean().notNull().default(false),
    /** Phase 2: the calendar Planner creates to push tasks into. Never mirrored or listed. */
    is_planner_calendar: boolean().notNull().default(false),
    created_at: timestamptz().notNull().defaultNow(),
    updated_at: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('calendars_source_idx').on(t.account_id, t.provider_calendar_id),
    index('calendars_user_idx').on(t.user_id),
  ],
);

export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type Calendar = typeof calendars.$inferSelect;
export type CalendarProvider = CalendarAccount['provider'];
