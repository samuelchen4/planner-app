import type { PlannerItem } from '@planner/core';
import { cn } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { dateKey } from '@/features/day-view/time';
import { DrawnRing, useDrawProgress } from '@/lib/drawn-ring';
import { haptics } from '@/lib/haptics';
import { openItem } from '@/lib/open-item';
import { useColors } from '@/lib/theme';

import { HabitBadge, useHabitLook } from './habit-look';

const DOT = 32;

interface Props {
  habit: PlannerItem;
  /** The days shown, oldest first, ending today. */
  days: Date[];
  today: Date;
  /** Days it was done ('YYYY-MM-DD'). */
  done: Set<string>;
  streak: number;
  onToggleDay: (day: Date) => void;
}

/**
 * One habit, as a card in its colour (fill and border), like a list's sticky note: its badge
 * (icon on its colour), title and streak, then the last 7 days as dots, today on the right.
 * Tap a dot to check that day off or un-check it; tap anywhere else on the card to open the habit.
 * Filled dots use the habit's colour; today's open dot has a coloured ring.
 */
export function HabitCard({ habit, days, today, done, streak, onToggleDay }: Props) {
  const { paper, edge: tint } = useHabitLook(habit);
  const todayKey = dateKey(today);

  return (
    // In the habit's colour, like a list's sticky note: paper fill, clear edge. Tapping the card
    // anywhere but a dot opens the habit. (Not an accessibility element itself, so VoiceOver still
    // reaches the dots; the title is the button for it.)
    <Pressable
      onPress={() => openItem(habit.id)}
      accessible={false}
      className="rounded-card gap-3 p-4 active:opacity-80"
      style={{ backgroundColor: paper, borderColor: tint, borderWidth: 1.5 }}
    >
      <View className="flex-row items-center gap-3">
        <HabitBadge habit={habit} />
        <Text
          numberOfLines={1}
          accessibilityRole="button"
          accessibilityHint="Opens the habit"
          onPress={() => openItem(habit.id)}
          className="text-headline text-ink shrink font-semibold"
        >
          {habit.title}
        </Text>
        <View className="flex-1" />
        {streak > 0 && (
          <View
            className="flex-row items-center gap-1"
            accessible
            accessibilityLabel={`${streak} day streak`}
          >
            <SymbolView name="flame.fill" size={13} tintColor={tint} />
            <Text className="text-footnote text-muted" style={{ fontVariant: ['tabular-nums'] }}>
              {streak} {streak === 1 ? 'day' : 'days'}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row justify-between">
        {days.map((day) => {
          const key = dateKey(day);
          const checked = done.has(key);
          const isToday = key === todayKey;
          return (
            <View key={key} className="items-center gap-1.5">
              <Text
                className={cn(
                  'text-caption2',
                  isToday ? 'text-ink font-bold' : 'text-muted font-medium',
                )}
              >
                {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Text>
              <HabitDot
                checked={checked}
                isToday={isToday}
                tint={tint}
                label={day.toLocaleDateString(undefined, { weekday: 'long' })}
                onPress={() => {
                  haptics.check();
                  onToggleDay(day);
                }}
              />
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/**
 * One day's dot. Checking it off draws a ring around it like a pen, then fills it in with a
 * checkmark; un-checking reverses quickly. Open days show a faint ring (today's solid).
 */
function HabitDot({
  checked,
  isToday,
  tint,
  label,
  onPress,
}: {
  checked: boolean;
  isToday: boolean;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const progress = useDrawProgress(checked);
  const fill = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.6, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.get(), [0.6, 1], [0.6, 1], Extrapolation.CLAMP) }],
  }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="items-center justify-center rounded-full"
      style={{
        width: DOT,
        height: DOT,
        borderWidth: checked ? 0 : isToday ? 2 : 1.5,
        // Open days: a faint ring in the habit's colour; today's is solid.
        borderColor: isToday ? tint : `${tint}66`,
      }}
    >
      <DrawnRing progress={progress} size={DOT} strokeWidth={2.5} color={tint} />
      <Animated.View
        className="absolute inset-0 items-center justify-center rounded-full"
        style={[{ backgroundColor: tint }, fill]}
      >
        <SymbolView name="checkmark" size={13} weight="bold" tintColor={colors['on-accent']} />
      </Animated.View>
    </Pressable>
  );
}
