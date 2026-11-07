// Side-by-side layout for overlapping blocks (like Google Calendar): each group of blocks that
// overlap each other is split into columns, and every block in the group gets the same width.

export interface Placed<T> {
  item: T;
  column: number;
  columns: number;
}

export function layoutColumns<T extends { startMin: number; endMin: number }>(
  items: T[],
  /** Short blocks are drawn taller than their duration; use that visual end for overlap checks. */
  minVisualMin: number,
): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: Placed<T>[] = [];

  let group: Placed<T>[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const p of group) p.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    const end = Math.max(item.endMin, item.startMin + minVisualMin);
    if (item.startMin >= groupEnd) closeGroup();

    let column = columnEnds.findIndex((colEnd) => colEnd <= item.startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }

    const p = { item, column, columns: 1 };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, end);
  }
  closeGroup();

  return placed;
}
