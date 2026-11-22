import '@azure/core-asynciterator-polyfill';

import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import {
  PowerSyncDatabase,
  SyncStreamConnectionMethod,
  type Transaction,
} from '@powersync/react-native';

import { connector } from './connector';
import type { TableWriter } from './local-table';
import { AppSchema } from './powersync-schema';
import { fromSqlite, toSqlite } from './sqlite-values';
import type { StoredRows } from './tables';

const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new OPSqliteOpenFactory({ dbFilename: 'planner.db' }),
});

db.registerListener({
  statusChanged: (s) => {
    const downloadError = s.dataFlowStatus.downloadError;
    const uploadError = s.dataFlowStatus.uploadError;
    if (downloadError) {
      const e = downloadError as Error;
      console.warn('[sync] Download error:', e.message, JSON.stringify(e.stack ?? 'no stack'));
    }
    if (uploadError) {
      console.warn('[sync] Upload error:', uploadError.message, '\n', uploadError.stack);
    }
    if (__DEV__) {
      console.log(
        `[sync] connected=${s.connected} connecting=${s.connecting} downloading=${s.dataFlowStatus.downloading} hasSynced=${s.hasSynced}`,
      );
    }
  },
});

const DATA_VERSION = 2;

const migrations: Record<number, (tx: Transaction) => Promise<void>> = {};

type Statement = [sql: string, params: unknown[]];

const value = toSqlite;

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

/** Where each kept table's rows come from (the SQLite table name). */
const SOURCES = {
  tasks: 'tasks',
  habitDays: 'habit_days',
  calendarAccounts: 'calendar_accounts',
  calendars: 'calendars',
  externalEvents: 'external_events',
} as const satisfies Record<keyof StoredRows, string>;

type RowsKey = keyof StoredRows;
const TABLE_KEYS = Object.keys(SOURCES) as RowsKey[];

async function readTable<K extends RowsKey>(key: K): Promise<StoredRows[K]> {
  const table = SOURCES[key];
  const rows = await db.getAll<StoredRows[K][number]>(`SELECT * FROM ${table}`);
  return rows.map((r) => fromSqlite(table, r)) as StoredRows[K];
}

async function readRows(keys: RowsKey[] = TABLE_KEYS): Promise<Partial<StoredRows>> {
  const out: Partial<StoredRows> = {};
  for (const key of keys) (out as Record<RowsKey, unknown>)[key] = await readTable(key);
  return out;
}

const readAllRows = async (): Promise<StoredRows> => readRows() as Promise<StoredRows>;

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

  db.connect(connector, { connectionMethod: SyncStreamConnectionMethod.HTTP }).catch((e) =>
    console.warn('[sync] Connecting failed:', e),
  );
  return readAllRows();
}

/** SQLite table name (as PowerSync reports it: 'ps_data__tasks' …) → kept table key. */
const keyOfTable = (name: string): RowsKey | undefined => {
  const table = name.replace(/^ps_data(_local)?__/, '');
  return TABLE_KEYS.find((k) => SOURCES[k] === table);
};

/**
 * Calls `onRows` with the tables that changed (synced or local writes), re-read once local writes
 * have flushed. Unknown change sets re-read everything.
 */
export function watchRemoteChanges(onRows: (rows: Partial<StoredRows>) => void): () => void {
  const changed = new Set<RowsKey>();
  const reload = async () => {
    await flush();
    if (pending.length || !changed.size) return;
    const keys = [...changed];
    changed.clear();
    const rows = await readRows(keys);
    if (pending.length) {
      // A local write came in meanwhile: read these again after it.
      for (const k of keys) changed.add(k);
      return;
    }
    onRows(rows);
  };
  return db.onChange(
    {
      onChange: (event) => {
        const keys = event.changedTables.map(keyOfTable).filter((k) => k !== undefined);
        for (const k of keys.length ? keys : TABLE_KEYS) changed.add(k);
        void reload();
      },
    },
    { tables: Object.values(SOURCES), throttleMs: 100 },
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
