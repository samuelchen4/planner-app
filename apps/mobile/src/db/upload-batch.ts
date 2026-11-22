import { BOOLEAN_COLUMNS } from './sqlite-values';

/** One local change as PowerSync queues it (the fields of a CrudEntry the upload needs). */
export interface QueuedChange {
  op: 'PUT' | 'PATCH' | 'DELETE';
  table: string;
  id: string;
  opData?: Record<string, unknown>;
}

/** One change in the body of POST /sync/upload. */
export interface UploadChange {
  op: QueuedChange['op'];
  type: string;
  id: string;
  data?: Record<string, unknown>;
}

/** Tables only the server writes: local changes to them are never sent. */
const SERVER_ONLY = new Set(['calendar_accounts', 'external_events']);
/** Calendars: the app may only switch one on or off (the backend accepts nothing else). */
const CALENDAR_COLUMNS = ['is_selected'];

/**
 * The upload form of a queued change, or null to drop it. Booleans go back to true/false (SQLite
 * queued them as 1/0, and the server validates real booleans). A calendar change is sent only as a
 * PATCH of `is_selected`.
 */
export function toUploadChange(change: QueuedChange): UploadChange | null {
  const { op, table, id } = change;
  if (SERVER_ONLY.has(table)) return null;
  let data = change.opData;
  if (table === 'calendars') {
    if (op !== 'PATCH' || !data) return null;
    data = Object.fromEntries(Object.entries(data).filter(([k]) => CALENDAR_COLUMNS.includes(k)));
    if (!Object.keys(data).length) return null;
  }
  const booleans = BOOLEAN_COLUMNS[table];
  if (data && booleans?.length) {
    data = { ...data };
    for (const c of booleans) {
      const v = data[c];
      if (v !== undefined && v !== null) data[c] = v === true || v === 1 || v === '1';
    }
  }
  return data === undefined ? { op, type: table, id } : { op, type: table, id, data };
}
