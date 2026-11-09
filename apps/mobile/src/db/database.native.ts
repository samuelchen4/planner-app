// Watched queries (used once the backend syncs) need async iterators.
import '@azure/core-asynciterator-polyfill';

import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { PowerSyncDatabase } from '@powersync/react-native';

import type { TableWriter } from './local-table';
import { AppSchema } from './powersync-schema';
import type { HabitDay, Task } from './schema';
import type { StoredRows } from './tables';

// The phone's database (PowerSync, SQLite file planner.db). Local only for now. Every write is
// already queued by PowerSync for upload, so once the backend exists, `db.connect(connector)`
// starts syncing. At that point, also watch the tables (db.watch) and reload the in-memory copies
// when another device changes them.
// The SQLite engine underneath is op-sqlite (PowerSync's recommended one), via its adapter;
// without the factory PowerSync falls back to looking for react-native-quick-sqlite.
const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new OPSqliteOpenFactory({ dbFilename: 'planner.db' }),
});

/**
 * Bump when the local tables change shape in a way old data can't follow (before the backend
 * exists, that's easier than migrating): the device's data is cleared and the samples go back in.
 */
const LOCAL_DATA_VERSION = '2';

/**
 * Open the database and read every row. On the very first launch (or a new LOCAL_DATA_VERSION),
 * `seed` (sample data) is written first; a device-only flag records that, so deleting everything
 * later doesn't bring it back.
 */
export async function openDatabase(seed: () => StoredRows): Promise<StoredRows> {
  await db.init();
  const version = await db.getOptional<{ value: string }>(
    'SELECT value FROM local_meta WHERE id = ?',
    ['data_version'],
  );
  if (version?.value !== LOCAL_DATA_VERSION) {
    // Old or no data: start over (also empties the upload queue).
    await db.disconnectAndClear();
    const { tasks, habitDays } = seed();
    for (const row of tasks) writer.insert('tasks', row);
    for (const row of habitDays) writer.insert('habit_days', row);
    await flush();
    await db.execute('INSERT OR REPLACE INTO local_meta (id, value) VALUES (?, ?)', [
      'data_version',
      LOCAL_DATA_VERSION,
    ]);
  }
  return {
    tasks: await db.getAll<Task>('SELECT * FROM tasks'),
    habitDays: await db.getAll<HabitDay>('SELECT * FROM habit_days'),
  };
}

type Statement = [sql: string, params: unknown[]];

/** Statements waiting to be written. Everything changed in one go is saved in one transaction. */
let pending: Statement[] = [];
let saving: Promise<void> = Promise.resolve();

function queue(statement: Statement) {
  if (!pending.length) queueMicrotask(() => void flush());
  pending.push(statement);
}

function flush(): Promise<void> {
  const batch = pending;
  pending = [];
  if (!batch.length) return saving;
  saving = saving
    .then(() =>
      db.writeTransaction(async (tx) => {
        for (const [sql, params] of batch) await tx.execute(sql, params);
      }),
    )
    .catch((e) => console.warn('[db] Saving failed:', e));
  return saving;
}

/** SQLite has no undefined: missing values are NULL. */
const value = (v: unknown) => (v === undefined ? null : v);

export const writer: TableWriter = {
  insert(table, row) {
    const cols = Object.keys(row);
    queue([
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => value(row[c as keyof typeof row])),
    ]);
  },
  update(table, id, patch) {
    const cols = Object.keys(patch).filter((c) => c !== 'id');
    if (!cols.length) return;
    queue([
      `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...cols.map((c) => value(patch[c as keyof typeof patch])), id],
    ]);
  },
  delete(table, ids) {
    queue([`DELETE FROM ${table} WHERE id IN (${ids.map(() => '?').join(', ')})`, ids]);
  },
};
