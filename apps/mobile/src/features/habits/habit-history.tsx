import type { PlannerItem } from '@planner/core';
import { cn } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { addDays, dateKey, relativeDayName, startOfWeek } from '@/features/day-view/time';
import { DraftInput } from '@/features/item-details/draft-input';
import { DrawnRing, useDrawProgress } from '@/lib/drawn-ring';
import { DOUBLE_TAP_MAX_DELAY_MS } from '@/lib/gestures';
import { haptics } from '@/lib/haptics';
import { usePlannerStore } from '@/lib/planner-store';
import { useColors } from '@/lib/theme';

import { setHabitDayNote, toggleHabitDay } from './habit-days';
import { useHabitLook } from './habit-look';

const CELL = 40;
/** Month grid column headers, Sunday first. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  // 2026-01-04 is a Sunday.
  new Date(2026, 0, 4 + i).toLocaleDateString(undefined, { weekday: 'narrow' }),
);

/**
 * A habit's history in its details sheet: a month calendar with the days it was done circled in
 * its colour (double-tap a day to check it off or un-check it), and below it the selected day: done or not, and that
 * day's note. Notes are per day (what happened that day), not per habit.
 */
export function HabitHistory({ habit }: { habit: PlannerItem }) {
  const { habitDays, setHabitDays } = usePlannerStore();
  const colors = useColors();
  const { edge } = useHabitLook(habit);
  const today = addDays(new Date(), 0);
  const [selected, setSelected] = useState(today);

  const days = habitDays.filter((d) => d.habitId === habit.id);
  const done = new Set(days.filter((d) => d.done).map((d) => d.date));
  const noted = new Set(days.filter((d) => d.note).map((d) => d.date));
  const row = days.find((d) => d.date === dateKey(selected));
  const isDone = row?.done ?? false;

  return (
    <>
      <HabitCalendar
        today={today}
        selected={selected}
        onSelect={setSelected}
        onToggle={(day) => {
          haptics.check();
          setHabitDays((prev) => toggleHabitDay(prev, habit.id, habit.userId, day));
        }}
        done={done}
        noted={noted}
        tint={edge}
      />

      <View className="bg-card rounded-card gap-3 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-headline text-ink font-semibold">{dayTitle(selected, today)}</Text>
          <Pressable
            onPress={() => {
              haptics.check();
              setHabitDays((prev) => toggleHabitDay(prev, habit.id, habit.userId, selected));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDone }}
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
            style={{
              backgroundColor: isDone ? edge : 'transparent',
              borderWidth: 1.5,
              borderColor: edge,
            }}
          >
            {isDone && (
              <SymbolView
                name="checkmark"
                size={12}
                weight="bold"
                tintColor={colors['on-accent']}
              />
            )}
            <Text
              className={cn('text-subhead font-semibold', isDone ? 'text-on-accent' : 'text-ink')}
            >
              {isDone ? 'Done' : 'Mark done'}
            </Text>
          </Pressable>
        </View>
        <DraftInput
          // A fresh draft per day.
          key={dateKey(selected)}
          value={row?.note ?? ''}
          onCommit={(note) =>
            setHabitDays((prev) => setHabitDayNote(prev, habit.id, habit.userId, selected, note))
          }
          placeholder="How did it go?"
          placeholderTextColor={colors.subtle}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          className="text-body text-ink p-0"
          style={{ minHeight: 100 }}
          accessibilityLabel="Day note"
        />
      </View>
    </>
  );
}

/** 'Today, Nov 8' / 'Tue, Nov 3'. */
function dayTitle(day: Date, today: Date): string {
  const name = relativeDayName(day, today);
  return name.includes(',')
    ? name
    : `${name}, ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/**
 * Taps on the cells under a swipe area: a swipe can end with a tap on the cell it started on (the
 * web does this), which shouldn't pick it. `start`/`end` go in the pan's activate/finalize (via
 * scheduleOnRN); `blocked()` is true during a swipe and briefly after it.
 */
function useSwipeGuard() {
  const swiping = useRef(false);
  return {
    start: () => {
      swiping.current = true;
    },
    end: () => {
      setTimeout(() => {
        swiping.current = false;
      }, 80);
    },
    blocked: () => swiping.current,
  };
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2026, i, 1).toLocaleDateString(undefined, { month: 'short' }),
);
/** How far a swipe must travel (or how fast) to change the month. */
const SWIPE_PX = 50;
const SWIPE_VELOCITY = 500;
const SLIDE_MS = 160;

/**
 * The calendar: one month. Swipe left/right for the next/previous month (not past this month), or
 * tap the month title to pick a month (and year) from a grid. Done days are circled in the habit's
 * colour, the selected day is filled with it, days with a note get a small dot. A double tap
 * toggles a day done without selecting it; a single tap selects it after the double-tap wait.
 * Days after today can't be picked.
 */
function HabitCalendar({
  today,
  selected,
  onSelect,
  onToggle,
  done,
  noted,
  tint,
}: {
  today: Date;
  selected: Date;
  onSelect: (day: Date) => void;
  onToggle: (day: Date) => void;
  done: Set<string>;
  noted: Set<string>;
  tint: string;
}) {
  const colors = useColors();
  /** First of the month shown. */
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const [picking, setPicking] = useState(false);
  // A tap waiting to see if it's a double tap.
  const pending = useRef<{ key: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => clearTimeout(pending.current?.timer), []);
  const guard = useSwipeGuard();

  const todayKey = dateKey(today);
  const selectedKey = dateKey(selected);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = month < thisMonth;
  const first = startOfWeek(month);
  const weeks = Math.ceil(
    (month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7,
  );
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));

  const page = (dir: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));

  /**
   * A double tap toggles the day (without selecting it); a single tap selects it once the
   * double-tap wait has passed.
   */
  const tapDay = (day: Date) => {
    if (guard.blocked()) return;
    const key = dateKey(day);
    const prev = pending.current;
    if (prev) clearTimeout(prev.timer);
    pending.current = null;
    if (prev?.key === key) {
      onToggle(day);
      return;
    }
    pending.current = {
      key,
      timer: setTimeout(() => {
        pending.current = null;
        if (key !== selectedKey) haptics.tick();
        onSelect(day);
      }, DOUBLE_TAP_MAX_DELAY_MS),
    };
  };

  // Swipe: the grid follows the finger, then slides out and the new month slides in.
  const width = useSharedValue(320);
  const shift = useSharedValue(0);
  const canNextSV = useSharedValue(canNext);
  useEffect(() => {
    canNextSV.set(canNext);
  }, [canNext, canNextSV]);
  const swipe = usePanGesture({
    enabled: !picking,
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      scheduleOnRN(guard.start);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(guard.end);
    },
    onUpdate: (e) => {
      'worklet';
      // Resist when there's no next month.
      const x = e.translationX;
      shift.set(x < 0 && !canNextSV.get() ? x * 0.25 : x);
    },
    onDeactivate: (e) => {
      'worklet';
      const x = e.translationX;
      const fast = Math.abs(e.velocityX) > SWIPE_VELOCITY;
      const dir = x < 0 ? 1 : -1; // swipe left = next month
      if ((Math.abs(x) < SWIPE_PX && !fast) || (dir === 1 && !canNextSV.get())) {
        shift.set(withTiming(0, { duration: SLIDE_MS }));
        return;
      }
      const w = width.get();
      shift.set(
        withTiming(-dir * w, { duration: SLIDE_MS }, () => {
          'worklet';
          scheduleOnRN(page, dir);
          shift.set(dir * w);
          shift.set(withTiming(0, { duration: SLIDE_MS }));
        }),
      );
    },
  });
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.get() }],
    opacity: 1 - Math.min(Math.abs(shift.get()) / width.get(), 1) * 0.6,
  }));

  return (
    <View
      className="bg-card rounded-card gap-2 overflow-hidden px-3 pb-3 pt-3"
      onLayout={(e) => width.set(e.nativeEvent.layout.width)}
    >
      <Pressable
        onPress={() => setPicking((p) => !p)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}, choose month`}
        className="flex-row items-center gap-1.5 self-start pl-1 active:opacity-60"
      >
        <Text className={cn('text-headline font-semibold', picking ? 'text-accent' : 'text-ink')}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
      </Pressable>

      {picking ? (
        <MonthPicker
          month={month}
          thisMonth={thisMonth}
          tint={tint}
          onPick={(m) => {
            haptics.tick();
            setMonth(m);
            setPicking(false);
          }}
        />
      ) : (
        <GestureDetector gesture={swipe}>
          <Animated.View className="gap-2" style={slide}>
            <View className="flex-row justify-between">
              {WEEKDAYS.map((w, i) => (
                <Text
                  key={i}
                  className="text-caption2 text-subtle text-center font-medium"
                  style={{ width: CELL }}
                >
                  {w}
                </Text>
              ))}
            </View>

            {Array.from({ length: weeks }, (_, r) => (
              <View key={r} className="flex-row justify-between">
                {cells.slice(r * 7, r * 7 + 7).map((day) => {
                  const key = dateKey(day);
                  const isSelected = key === selectedKey;
                  const isDone = done.has(key);
                  const future = key > todayKey;
                  const outside = day.getMonth() !== month.getMonth();
                  return (
                    <Pressable
                      key={key}
                      disabled={future}
                      onPress={() => tapDay(day)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: future }}
                      accessibilityLabel={`${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${isDone ? ', done' : ''}`}
                      accessibilityHint="Double-tap quickly to check off"
                      className="items-center justify-center rounded-full"
                      style={{
                        width: CELL,
                        height: CELL,
                        opacity: future ? 0.3 : outside ? 0.45 : 1,
                        backgroundColor: isSelected ? tint : 'transparent',
                      }}
                    >
                      <DayRing done={isDone} tint={tint} />
                      <Text
                        className={cn(
                          'text-callout',
                          isSelected ? 'text-on-accent font-bold' : 'text-ink',
                          key === todayKey && !isSelected && 'font-bold',
                        )}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {day.getDate()}
                      </Text>
                      {noted.has(key) && (
                        <View
                          className="absolute rounded-full"
                          style={{
                            bottom: 4,
                            width: 4,
                            height: 4,
                            backgroundColor: isSelected ? colors['on-accent'] : tint,
                          }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

/**
 * Pick a month: the year (swipe or the small arrows to change it) and its 12 months. Months after
 * this one can't be picked.
 */
function MonthPicker({
  month,
  thisMonth,
  tint,
  onPick,
}: {
  month: Date;
  thisMonth: Date;
  tint: string;
  onPick: (month: Date) => void;
}) {
  const colors = useColors();
  const [year, setYear] = useState(month.getFullYear());
  const guard = useSwipeGuard();
  const canNext = year < thisMonth.getFullYear();
  const step = (dir: number) => {
    if (dir > 0 && !canNext) return;
    haptics.tick();
    setYear((y) => y + dir);
  };
  const swipe = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      scheduleOnRN(guard.start);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(guard.end);
    },
    onDeactivate: (e) => {
      'worklet';
      if (Math.abs(e.translationX) < SWIPE_PX && Math.abs(e.velocityX) < SWIPE_VELOCITY) return;
      scheduleOnRN(step, e.translationX < 0 ? 1 : -1);
    },
  });

  return (
    <GestureDetector gesture={swipe}>
      <View className="gap-3 pt-1">
        <View className="flex-row items-center justify-center gap-4">
          <Pressable
            onPress={() => step(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            className="active:opacity-60"
          >
            <SymbolView name="chevron.left" size={13} weight="semibold" tintColor={colors.accent} />
          </Pressable>
          <Text
            className="text-headline text-ink font-semibold"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {year}
          </Text>
          <Pressable
            onPress={() => step(1)}
            disabled={!canNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next year"
            className="active:opacity-60"
            style={{ opacity: canNext ? 1 : 0.3 }}
          >
            <SymbolView
              name="chevron.right"
              size={13}
              weight="semibold"
              tintColor={colors.accent}
            />
          </Pressable>
        </View>
        <View className="gap-2">
          {[0, 1, 2].map((r) => (
            <View key={r} className="flex-row gap-2">
              {MONTHS.slice(r * 4, r * 4 + 4).map((name, c) => {
                const m = new Date(year, r * 4 + c, 1);
                const current =
                  m.getFullYear() === month.getFullYear() && m.getMonth() === month.getMonth();
                const future = m > thisMonth;
                return (
                  <Pressable
                    key={name}
                    disabled={future}
                    onPress={() => {
                      if (!guard.blocked()) onPick(m);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current, disabled: future }}
                    className="h-11 flex-1 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: current ? tint : colors.app,
                      opacity: future ? 0.35 : 1,
                    }}
                  >
                    <Text
                      className={cn(
                        'text-subhead font-semibold',
                        current ? 'text-on-accent' : 'text-ink',
                      )}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

/** The ring around a done day: drawn like a pen when it's checked off, un-drawn when un-checked. */
function DayRing({ done, tint }: { done: boolean; tint: string }) {
  const progress = useDrawProgress(done);
  return <DrawnRing progress={progress} size={CELL} strokeWidth={2} color={tint} />;
}
