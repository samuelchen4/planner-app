import { date, timestamp } from 'drizzle-orm/pg-core';

// Column helpers shared by the models. Dates and times are kept as strings in the app (ISO 8601),
// the same as SQLite stores them on the phone.

/** A moment in time with its UTC offset, e.g. '2026-11-09T09:30:00-08:00'. */
export const timestamptz = () => timestamp({ withTimezone: true, mode: 'string' });

/** A calendar day, e.g. '2026-11-09'. */
export const day = () => date({ mode: 'string' });
