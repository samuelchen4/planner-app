import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

import { calendarAccounts, calendars, externalEvents, habitDays, tasks } from './schema';

// SQLite has no booleans: PowerSync stores Postgres booleans as integers 0/1. The app's models
// keep real booleans (as the server has them), so values are converted at the edges: when rows
// are read from SQLite, when the app writes one, and when a change is uploaded.

const booleanColumnsOf = (table: PgTable) =>
  getTableConfig(table)
    .columns.filter((c) => c.getSQLType() === 'boolean')
    .map((c) => c.name);

/** Boolean columns per synced table (derived from the models, so they can't drift). */
export const BOOLEAN_COLUMNS: Record<string, readonly string[]> = Object.fromEntries(
  [tasks, habitDays, calendarAccounts, calendars, externalEvents].map((t) => [
    getTableConfig(t).name,
    booleanColumnsOf(t),
  ]),
);

/** A row as SQLite returns it → the model's shape (0/1 → false/true; null stays null). */
export function fromSqlite<Row extends object>(table: string, row: Row): Row {
  const columns = BOOLEAN_COLUMNS[table];
  if (!columns?.length) return row;
  const out = { ...row } as Record<string, unknown>;
  for (const c of columns) {
    const v = out[c];
    if (v !== null && v !== undefined) out[c] = v === true || v === 1 || v === '1';
  }
  return out as Row;
}

/** A value to bind into SQLite (booleans → 1/0). */
export function toSqlite(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
