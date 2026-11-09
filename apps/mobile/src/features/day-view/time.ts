// Time helpers for the day view. Positions are "minutes since local midnight" (0–1440).

export const MINUTES_PER_DAY = 24 * 60;
/** Duration assumed for a timed item that has a start but no end. */
export const DEFAULT_DURATION_MIN = 30;

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutes since local midnight for an ISO timestamp. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** ISO-8601 with the local offset, e.g. '2026-11-06T09:30:00-08:00' (the shape our tables store). */
export function toLocalIso(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Same local day as `baseIso`, at `minutes` past midnight (1440 = the next midnight). */
export function isoAtMinutes(baseIso: string, minutes: number): string {
  const d = new Date(baseIso);
  d.setHours(0, minutes, 0, 0);
  return toLocalIso(d);
}

/** Local calendar day as 'YYYY-MM-DD' (the same format as IsoDate). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight `days` days after `d` (DST-safe: steps by calendar day, not 24h). */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Local midnight of the Sunday on or before `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

/** 570 -> '9:30 AM' */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Compact edge label: whole hours as '5 AM', anything else as '9:20' (fits the narrow hour gutter). */
export function formatEdge(minutes: number): string {
  if (minutes % 60 === 0) return formatHour(minutes / 60);
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(minutes % 60)}`;
}

/** 9 -> '9 AM', 12 -> '12 PM' */
export function formatHour(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** 'YYYY-MM-DD' -> local midnight of that day. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'Today', 'Tomorrow', 'Yesterday', else a short date like 'Tue, Nov 10'. */
export function relativeDayName(day: Date, today: Date = new Date()): string {
  const offset = Math.round((addDays(day, 0).getTime() - addDays(today, 0).getTime()) / 86_400_000);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
