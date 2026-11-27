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
  /** Has notes: drawn with a small note icon by its title. */
  hasNotes: boolean;
  /** A day of a recurring task: a repeat icon by its title. */
  isRecurring?: boolean;
  /** Planner items: 0 = none, 1–3 = that level's border (calendar events: always 0). */
  priority?: number;
  /** Calendar events: their calendar's colour (hex; null = the neutral grey). */
  color?: string | null;
  /**
   * A planner task running past midnight shows as a piece per day: minutes from the task's start
   * to this piece's start (0 for the first piece). Drops move the task by this much less.
   */
  offsetMin?: number;
  /** Calendar events: the event's own times, e.g. '10:30 PM – 1:00 AM' (a block may be one day's
   *  piece of it). Defaults to the block's start – end. */
  timeLabel?: string;
}
