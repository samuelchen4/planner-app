import { column, Schema, Table, type BaseColumnType } from '@powersync/react-native';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { externalEvents, habitDays, tasks } from './schema';

type SqliteColumn = BaseColumnType<string | number | null>;

// The phone's tables, derived from the Drizzle models so the two can't drift. SQLite only has
// text, integer and real: uuids, dates and timestamps are text; PowerSync adds the `id` column.

function sqliteType(pgType: string): SqliteColumn {
  if (/^(integer|smallint|bigint|boolean)/.test(pgType)) return column.integer;
  if (/^(double precision|real|numeric)/.test(pgType)) return column.real;
  return column.text;
}

function toPowerSync(table: PgTable): Table {
  const config = getTableConfig(table);
  const columns = Object.fromEntries(
    config.columns.filter((c) => c.name !== 'id').map((c) => [c.name, sqliteType(c.getSQLType())]),
  );
  // Same indexes as Postgres (for the queries the app runs), unique or not.
  const indexes = Object.fromEntries(
    config.indexes.map((i) => [
      i.config.name ?? '',
      i.config.columns.map((c) => ('name' in c ? (c.name as string) : '')),
    ]),
  );
  return new Table(columns, { indexes });
}

export const AppSchema = new Schema({
  tasks: toPowerSync(tasks),
  habit_days: toPowerSync(habitDays),
  external_events: toPowerSync(externalEvents),
  /** Device-only bookkeeping, never synced (e.g. whether the sample data was added). */
  local_meta: new Table({ value: column.text }, { localOnly: true }),
});
