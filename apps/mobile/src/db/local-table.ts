import { useSyncExternalStore } from 'react';

/** Where a table's changes are saved: the phone's database (database.native.ts), or nowhere. */
export interface TableWriter {
  insert(table: string, row: object): void;
  update(table: string, id: string, patch: object): void;
  delete(table: string, ids: string[]): void;
}

/**
 * An in-memory copy of one database table that the screens read from. A change is applied here
 * first, synchronously (the screen updates on the same frame, and the next action already sees
 * it), and then handed to the writer to save in the background.
 */
export class LocalTable<Row extends { id: string }> {
  private rows = new Map<string, Row>();
  private sorted: Row[] = [];
  private listeners = new Set<() => void>();

  constructor(
    readonly name: string,
    private writer: TableWriter,
    /** Order of `all()`. */
    private compare: (a: Row, b: Row) => number,
  ) {}

  /** Fill from the database at launch (nothing is written back). */
  load(rows: Row[]) {
    this.rows = new Map(rows.map((r) => [r.id, r]));
    this.changed();
  }

  /** Every row, in order. The same array until something changes. */
  all = (): Row[] => this.sorted;

  get(id: string): Row | undefined {
    return this.rows.get(id);
  }

  insert(row: Row) {
    this.rows.set(row.id, row);
    this.changed();
    this.writer.insert(this.name, row);
  }

  update(id: string, patch: Partial<Row>) {
    const row = this.rows.get(id);
    if (!row) return;
    this.rows.set(id, { ...row, ...patch });
    this.changed();
    this.writer.update(this.name, id, patch);
  }

  delete(ids: string[]) {
    const gone = ids.filter((id) => this.rows.delete(id));
    if (!gone.length) return;
    this.changed();
    this.writer.delete(this.name, gone);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private changed() {
    this.sorted = [...this.rows.values()].sort(this.compare);
    for (const listener of this.listeners) listener();
  }
}

/** A table's rows in a component; re-renders when they change. */
export function useRows<Row extends { id: string }>(table: LocalTable<Row>): Row[] {
  return useSyncExternalStore(table.subscribe, table.all);
}
