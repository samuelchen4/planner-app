/** Height of one hour on the timeline, in points. */
export const HOUR_HEIGHT = 64;
export const PX_PER_MIN = HOUR_HEIGHT / 60;
/** Dragged blocks snap to this many minutes. */
export const SNAP_MIN = 15;
/** Shortest a block is drawn (in minutes of height), so 5-minute events stay readable and tappable. */
export const MIN_BLOCK_MIN = 20;
/** Space above the first line and below the last, so the edge hour labels aren't clipped. */
export const GRID_PAD_Y = 8;
/** Width of the hour-label column on the left. */
export const GUTTER_WIDTH = 46;

/** The slice of a day a grid shows, in minutes since midnight. */
export interface TimeWindow {
  startMin: number;
  endMin: number;
}

/** Total height of a day's grid for a window, padding included. */
export const gridHeight = (w: TimeWindow) => GRID_PAD_Y * 2 + (w.endMin - w.startMin) * PX_PER_MIN;

/** What the timeline draws: a planner item or calendar event, flattened to minutes of the day. */
export interface TimelineEntry {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  /** Only our own planner items move; Google events are a read-only mirror. */
  draggable: boolean;
  tone: 'planner' | 'calendar';
  /** Planner items can be checked off; calendar events can't (they have no checkbox). */
  checkable: boolean;
  done: boolean;
  /** A list (a task with entries of its own): drawn with a small list icon by its title. */
  isList: boolean;
}
