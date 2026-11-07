// User-configurable settings shared by every client. In-memory for now; later these live in a
// per-user settings table that syncs like everything else.

/** Times are minutes since local midnight (0–1439). 420 = 7:00 AM. */
export type MinuteOfDay = number;

/**
 * The day grid's default visible window: what a day shows when it has nothing scheduled.
 * Days with items outside the window stretch to fit them.
 */
export interface ScheduleSettings {
  dayStartMin: MinuteOfDay;
  dayEndMin: MinuteOfDay;
}

/** 12:01 AM: earliest allowed start. */
export const SCHEDULE_MIN_START: MinuteOfDay = 1;
/** 11:59 PM: latest allowed end. */
export const SCHEDULE_MAX_END: MinuteOfDay = 23 * 60 + 59;
/** The window is never shorter than this. */
export const SCHEDULE_MIN_SPAN = 60;

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  dayStartMin: 7 * 60, // 7:00 AM
  dayEndMin: 22 * 60, // 10:00 PM
};

/**
 * Makes any input valid: fills gaps from the defaults, rounds to whole minutes, clamps to
 * 12:01 AM – 11:59 PM, and keeps end at least SCHEDULE_MIN_SPAN after start.
 */
export function normalizeSchedule(input: Partial<ScheduleSettings> = {}): ScheduleSettings {
  const pick = (v: number | undefined, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const dayStartMin = clamp(
    pick(input.dayStartMin, DEFAULT_SCHEDULE.dayStartMin),
    SCHEDULE_MIN_START,
    SCHEDULE_MAX_END - SCHEDULE_MIN_SPAN,
  );
  const dayEndMin = clamp(
    pick(input.dayEndMin, DEFAULT_SCHEDULE.dayEndMin),
    dayStartMin + SCHEDULE_MIN_SPAN,
    SCHEDULE_MAX_END,
  );
  return { dayStartMin, dayEndMin };
}
