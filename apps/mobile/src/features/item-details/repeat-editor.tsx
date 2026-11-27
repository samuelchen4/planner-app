import {
  addDaysToKey,
  presetRecurrence,
  shortDateLabel,
  type Recurrence,
  type RepeatFreq,
} from '@planner/core';
import { cn } from '@planner/ui';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dateKey, parseDateKey } from '@/features/day-view/time';
import { haptics } from '@/lib/haptics';

import { CalendarPicker } from './pickers';

type Mode = RepeatFreq | 'custom';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'daily', label: 'Daily' },
  { mode: 'weekly', label: 'Weekly' },
  { mode: 'monthly', label: 'Monthly' },
  { mode: 'custom', label: 'Custom' },
];
const UNITS: { freq: RepeatFreq; label: string }[] = [
  { freq: 'daily', label: 'Days' },
  { freq: 'weekly', label: 'Weeks' },
  { freq: 'monthly', label: 'Months' },
];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A rounded toggle: accent fill when on. */
function Chip({
  on,
  label,
  onPress,
  className,
  accessibilityLabel,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
  className?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={cn(
        'items-center justify-center rounded-xl active:opacity-60',
        on ? 'bg-accent' : 'bg-app',
        className,
      )}
    >
      <Text
        className={cn('text-subhead font-semibold', on ? 'text-on-accent' : 'text-ink')}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Toggle `n` in `xs`, never leaving it empty. */
const toggleIn = (xs: number[], n: number) =>
  xs.includes(n)
    ? xs.length > 1
      ? xs.filter((x) => x !== n)
      : xs
    : [...xs, n].sort((a, b) => a - b);

/**
 * Edits a repeat rule: Daily / Weekly (pick weekdays) / Monthly (pick days of the month) / Custom
 * (every N days, weeks or months), and when it ends. `start` is the first day ('YYYY-MM-DD'): the
 * presets start from its weekday or date.
 */
export function RepeatEditor({
  value,
  start,
  onChange,
}: {
  value: Recurrence;
  start: string;
  onChange: (r: Recurrence) => void;
}) {
  const [mode, setMode] = useState<Mode>(value.interval > 1 ? 'custom' : value.freq);
  const set = (patch: Partial<Recurrence>) => onChange({ ...value, ...patch });
  const pickMode = (m: Mode) => {
    setMode(m);
    if (m === 'custom') return set({ interval: Math.max(2, value.interval) });
    onChange({ ...presetRecurrence(m, start), until: value.until });
  };
  const pickUnit = (freq: RepeatFreq) =>
    onChange({ ...presetRecurrence(freq, start), interval: value.interval, until: value.until });
  const firstWeekday = parseDateKey(start).getDay();
  const firstMonthDay = parseDateKey(start).getDate();
  const weekdays = value.weekdays.length ? value.weekdays : [firstWeekday];
  const monthDays = value.monthDays.length ? value.monthDays : [firstMonthDay];
  const unit = UNITS.find((u) => u.freq === value.freq)!.label.toLowerCase();

  return (
    <View className="gap-4">
      <View className="flex-row gap-1.5">
        {MODES.map((m) => (
          <Chip
            key={m.mode}
            on={mode === m.mode}
            label={m.label}
            onPress={() => pickMode(m.mode)}
            className="h-9 flex-1"
          />
        ))}
      </View>

      {mode === 'custom' && (
        <View className="gap-2">
          <View className="flex-row items-center gap-3">
            <Text className="text-body text-ink">Every</Text>
            <Chip
              on={false}
              label="−"
              onPress={() => set({ interval: Math.max(1, value.interval - 1) })}
              className="h-9 w-9"
              accessibilityLabel="Fewer"
            />
            <Text
              className="text-headline text-ink min-w-6 text-center font-semibold"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {value.interval}
            </Text>
            <Chip
              on={false}
              label="+"
              onPress={() => set({ interval: Math.min(99, value.interval + 1) })}
              className="h-9 w-9"
              accessibilityLabel="More"
            />
            <Text className="text-body text-ink">
              {value.interval === 1 ? unit.slice(0, -1) : unit}
            </Text>
          </View>
          <View className="flex-row gap-1.5">
            {UNITS.map((u) => (
              <Chip
                key={u.freq}
                on={value.freq === u.freq}
                label={u.label}
                onPress={() => pickUnit(u.freq)}
                className="h-9 flex-1"
              />
            ))}
          </View>
        </View>
      )}

      {value.freq === 'weekly' && (
        <View className="flex-row justify-between">
          {WEEKDAY_LETTERS.map((letter, d) => (
            <Chip
              key={d}
              on={weekdays.includes(d)}
              label={letter}
              onPress={() => set({ weekdays: toggleIn(weekdays, d) })}
              className="h-9 w-9 rounded-full"
              accessibilityLabel={
                ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]
              }
            />
          ))}
        </View>
      )}

      {value.freq === 'monthly' && (
        <View className="gap-1.5">
          <View className="flex-row flex-wrap" style={{ rowGap: 6 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
              <View key={n} style={{ width: `${100 / 7}%` }} className="items-center">
                <Chip
                  on={monthDays.includes(n)}
                  label={String(n)}
                  onPress={() => set({ monthDays: toggleIn(monthDays, n) })}
                  className="h-9 w-9 rounded-full"
                />
              </View>
            ))}
          </View>
          {monthDays.some((n) => n > 28) && (
            <Text className="text-footnote text-muted">Months without that day are skipped.</Text>
          )}
        </View>
      )}

      <View className="gap-2">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-body text-ink mr-auto">Ends</Text>
          <Chip
            on={!value.until}
            label="Never"
            onPress={() => set({ until: null })}
            className="h-9 px-3"
          />
          <Chip
            on={!!value.until}
            label={value.until ? shortDateLabel(value.until) : 'On a date'}
            onPress={() => set({ until: value.until ?? addDaysToKey(start, 30) })}
            className="h-9 px-3"
          />
        </View>
        {value.until && (
          <CalendarPicker
            value={parseDateKey(value.until)}
            onChange={(d) => {
              const key = dateKey(d);
              set({ until: key < start ? start : key });
            }}
          />
        )}
      </View>
    </View>
  );
}
