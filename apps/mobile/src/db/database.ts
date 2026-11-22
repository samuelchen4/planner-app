import type { TableWriter } from './local-table';
import { sampleRows } from './sample-data';
import type { StoredRows } from './tables';

export async function openDatabase(_userId: string): Promise<StoredRows> {
  return __DEV__
    ? sampleRows()
    : { tasks: [], habitDays: [], calendarAccounts: [], calendars: [], externalEvents: [] };
}

export function watchRemoteChanges(_onRows: (rows: Partial<StoredRows>) => void): () => void {
  return () => {};
}

export async function pendingUploads(): Promise<number> {
  return 0;
}

export async function closeDatabase() {}

export const writer: TableWriter = {
  insert() {},
  update() {},
  delete() {},
};
