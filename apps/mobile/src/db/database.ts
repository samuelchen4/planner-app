import type { TableWriter } from './local-table';
import type { StoredRows } from './tables';

// The web build's stand-in for the phone's database (database.native.ts). PowerSync's SQLite
// doesn't run in the browser (used for testing), so here nothing is saved: the app starts from
// the sample data on every load.

export async function openDatabase(seed: () => StoredRows): Promise<StoredRows> {
  return seed();
}

export const writer: TableWriter = {
  insert() {},
  update() {},
  delete() {},
};
