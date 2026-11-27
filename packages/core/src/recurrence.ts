// Recurring tasks: the repeat rule, stored on the series task as an RFC 5545 RRULE (the subset
// the app makes), and which days it falls on. Pure functions on 'YYYY-MM-DD' day keys, so they
// work the same on every client (planner-web keeps a copy of this file: change both together).
//
// A series is one task row with `rrule` set; its date (and time, if any) is the first day and the
// time every day gets. Days are shown from the rule; a day becomes its own task row (series_id +
// occurrence_date, id = occurrenceId) only once it's changed: checked off, moved, or deleted.

export type RepeatFreq = 'daily' | 'weekly' | 'monthly';

export interface Recurrence {
  freq: RepeatFreq;
  /** Every `interval` days / weeks / months (1 = every one). */
  interval: number;
  /** Weekly: weekdays, 0 = Sunday … 6 = Saturday. Empty = the first day's weekday. */
  weekdays: number[];
  /** Monthly: days of the month, 1–31 (months without that day skip it). Empty = the first day's. */
  monthDays: number[];
  /** Last day it can fall on ('YYYY-MM-DD'), or null for forever. */
  until: string | null;
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQS: Record<string, RepeatFreq> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' };

const sortedUnique = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

/** The RRULE text for a rule, e.g. 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20270301'. */
export function formatRRule(r: Recurrence): string {
  const parts = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'weekly' && r.weekdays.length) {
    parts.push(
      `BYDAY=${sortedUnique(r.weekdays)
        .map((d) => BYDAY[d])
        .join(',')}`,
    );
  }
  if (r.freq === 'monthly' && r.monthDays.length) {
    parts.push(`BYMONTHDAY=${sortedUnique(r.monthDays).join(',')}`);
  }
  if (r.until) parts.push(`UNTIL=${r.until.replaceAll('-', '')}`);
  return parts.join(';');
}

/** A stored RRULE back to a rule; null when it isn't one the app understands. */
export function parseRRule(text: string | null | undefined): Recurrence | null {
  if (!text) return null;
  const fields = new Map(
    text
      .replace(/^RRULE:/i, '')
      .split(';')
      .map((p) => p.split('=') as [string, string])
      .map(([k, v]) => [k?.trim().toUpperCase(), (v ?? '').trim().toUpperCase()]),
  );
  const freq = FREQS[fields.get('FREQ') ?? ''];
  if (!freq) return null;
  const interval = Math.max(1, Math.floor(Number(fields.get('INTERVAL') ?? 1)) || 1);
  const weekdays = (fields.get('BYDAY') ?? '')
    .split(',')
    .map((d) => BYDAY.indexOf(d.slice(-2)))
    .filter((d) => d >= 0);
  const monthDays = (fields.get('BYMONTHDAY') ?? '')
    .split(',')
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 31);
  const u = /^(\d{4})(\d{2})(\d{2})/.exec(fields.get('UNTIL') ?? '');
  return {
    freq,
    interval,
    weekdays: sortedUnique(weekdays),
    monthDays: sortedUnique(monthDays),
    until: u ? `${u[1]}-${u[2]}-${u[3]}` : null,
  };
}

// ─── Day arithmetic on 'YYYY-MM-DD' keys (UTC under the hood, so no DST surprises) ──────────────

const DAY_MS = 86_400_000;
const toUtc = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDaysToKey = (key: string, n: number) => fromUtc(toUtc(key) + n * DAY_MS);
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
const weekdayOf = (key: string) => new Date(toUtc(key)).getUTCDay();
/** Monday-based weeks (RRULE's default week start). */
const mondayOf = (key: string) => addDaysToKey(key, -((weekdayOf(key) + 6) % 7));
const monthIndex = (key: string) => +key.slice(0, 4) * 12 + +key.slice(5, 7) - 1;

/** Whether the series that starts on `start` falls on `day`. */
export function occursOn(r: Recurrence, start: string, day: string): boolean {
  if (day < start || (r.until && day > r.until)) return false;
  switch (r.freq) {
    case 'daily':
      return daysBetween(start, day) % r.interval === 0;
    case 'weekly': {
      const weekdays = r.weekdays.length ? r.weekdays : [weekdayOf(start)];
      if (!weekdays.includes(weekdayOf(day))) return false;
      return (daysBetween(mondayOf(start), mondayOf(day)) / 7) % r.interval === 0;
    }
    case 'monthly': {
      const monthDays = r.monthDays.length ? r.monthDays : [+start.slice(8, 10)];
      if (!monthDays.includes(+day.slice(8, 10))) return false;
      return (monthIndex(day) - monthIndex(start)) % r.interval === 0;
    }
  }
}

/** Every day from `from` to `to` (inclusive) the series falls on. */
export function occurrencesBetween(
  r: Recurrence,
  start: string,
  from: string,
  to: string,
): string[] {
  const out: string[] = [];
  const first = from < start ? start : from;
  const last = r.until && r.until < to ? r.until : to;
  for (let d = first; d <= last; d = addDaysToKey(d, 1)) {
    if (occursOn(r, start, d)) out.push(d);
  }
  return out;
}

// ─── Labels ──────────────────────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

/** 'Mar 1, 2027' for a day key. */
export const shortDateLabel = (key: string) =>
  `${MONTH_SHORT[+key.slice(5, 7) - 1]} ${+key.slice(8, 10)}, ${key.slice(0, 4)}`;

/**
 * 'Daily', 'Every 2 weeks on Mon, Thu', 'Monthly on the 1st, 15th', '… until Mar 1, 2027'.
 * `start` fills in the default weekday / month day.
 */
export function describeRecurrence(r: Recurrence, start: string): string {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[r.freq];
  let text =
    r.interval === 1
      ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[r.freq]
      : `Every ${r.interval} ${unit}s`;
  if (r.freq === 'weekly') {
    const days = r.weekdays.length ? r.weekdays : [weekdayOf(start)];
    text +=
      days.length === 7 ? ' on every day' : ` on ${days.map((d) => WEEKDAY_SHORT[d]).join(', ')}`;
  }
  if (r.freq === 'monthly') {
    const days = r.monthDays.length ? r.monthDays : [+start.slice(8, 10)];
    text += ` on the ${days.map(ordinal).join(', ')}`;
  }
  if (r.until) text += `, until ${shortDateLabel(r.until)}`;
  return text;
}

/** A plain rule for a preset, around the first day (Weekly: its weekday; Monthly: its date). */
export function presetRecurrence(freq: RepeatFreq, start: string): Recurrence {
  return {
    freq,
    interval: 1,
    weekdays: freq === 'weekly' ? [weekdayOf(start)] : [],
    monthDays: freq === 'monthly' ? [+start.slice(8, 10)] : [],
    until: null,
  };
}

// ─── Ids ─────────────────────────────────────────────────────────────────────────────────────

/** 32-bit FNV-1a, seeded. */
function fnv1a(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The id a series' day gets when it becomes its own row: the same on every device, so two devices
 * changing the same day write the same row instead of two copies. A version-8 (custom) UUID.
 */
export function occurrenceId(seriesId: string, day: string): string {
  const hex = [1, 2, 3, 4]
    .map((seed) =>
      fnv1a(`${seriesId}:${day}`, seed * 0x9e3779b1)
        .toString(16)
        .padStart(8, '0'),
    )
    .join('')
    .split('');
  hex[12] = '8';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
