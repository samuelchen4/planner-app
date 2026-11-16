import '@azure/core-asynciterator-polyfill';

import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { PowerSyncDatabase, type Transaction } from '@powersync/react-native';

import { connector } from './connector';
import type { TableWriter } from './local-table';
import { AppSchema } from './powersync-schema';
import type { HabitDay, Task } from './schema';
import type { StoredRows } from './tables';

const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new OPSqliteOpenFactory({ dbFilename: 'planner.db' }),
});

const DATA_VERSION = 2;

const migrations: Record<number, (tx: Transaction) => Promise<void>> = {};

type Statement = [sql: string, params: unknown[]];

const value = (v: unknown) => (v === undefined ? null : v);

function insertStatement(table: string, row: object): Statement {
  const cols = Object.keys(row);
  return [
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => value(row[c as keyof typeof row])),
  ];
}

async function getMeta(key: string): Promise<string | null> {
  const row = await db.getOptional<{ value: string }>('SELECT value FROM local_meta WHERE id = ?', [
    key,
  ]);
  return row?.value ?? null;
}

const SET_META = 'INSERT OR REPLACE INTO local_meta (id, value) VALUES (?, ?)';

async function migrate(from: number) {
  for (let version = from + 1; version <= DATA_VERSION; version++) {
    const step = migrations[version];
    await db.writeTransaction(async (tx) => {
      if (step) await step(tx);
      await tx.execute(SET_META, ['data_version', String(version)]);
    });
  }
}

const readRows = async (): Promise<StoredRows> => ({
  tasks: await db.getAll<Task>('SELECT * FROM tasks'),
  habitDays: await db.getAll<HabitDay>('SELECT * FROM habit_days'),
});

export async function openDatabase(userId: string): Promise<StoredRows> {
  await db.init();
  const version = await getMeta('data_version');
  if (version) await migrate(Number(version));
  else await db.execute(SET_META, ['data_version', String(DATA_VERSION)]);

  if ((await getMeta('owner')) !== userId) {
    await db.disconnectAndClear();
    await db.execute(SET_META, ['data_version', String(DATA_VERSION)]);
    await db.execute(SET_META, ['owner', userId]);
  }

  db.connect(connector).catch((e) => console.warn('[sync] Connecting failed:', e));
  return readRows();
}

export function watchRemoteChanges(onRows: (rows: StoredRows) => void): () => void {
  const reload = async () => {
    await flush();
    if (pending.length) return;
    const rows = await readRows();
    if (!pending.length) onRows(rows);
  };
  return db.onChange(
    { onChange: () => void reload() },
    { tables: ['tasks', 'habit_days'], throttleMs: 100 },
  );
}

export async function pendingUploads(): Promise<number> {
  return (await db.getUploadQueueStats()).count;
}

export async function closeDatabase() {
  await flush();
  await db.disconnectAndClear();
}

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

export const writer: TableWriter = {
  insert(table, row) {
    queue(insertStatement(table, row));
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
