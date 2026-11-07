import { cn } from '@planner/ui';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

import type { DayRange } from './day-range';
import { dateKey } from './time';

const DAYS_VISIBLE = 7;
/** Horizontal page padding (matches the canvas). */
export const PAGE_PAD_X = 12;

// 'Sun', 'Mon', … in the user's locale. 2026-01-04 is a Sunday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 0, 4 + i).toLocaleDateString(undefined, { weekday: 'short' }),
);

interface DateHeaderProps {
  range: DayRange;
  /** Selected day as 'YYYY-MM-DD'. */
  selected: string;
  onSelect: (key: string) => void;
  /** The canvas needs the header's height to pad its content and map scroll positions. */
  onHeightChange: (height: number) => void;
}

/**
 * Sticky header pinned over the top of the day view: frosted glass (the canvas scrolls under it),
 * holding the month title and the swipeable date strip.
 */
export function DateHeader({ range, selected, onSelect, onHeightChange }: DateHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  return (
    <View style={styles.shell} onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}>
      <BlurView tint="systemChromeMaterial" intensity={90} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top }}>
        <DateStrip range={range} selected={selected} onSelect={onSelect} />
      </View>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
    </View>
  );
}

/**
 * Month + year title over a strip of days (7 on screen, snapping a day at a time).
 * The title follows the leftmost visible day, so it flips to the next month (and year) as soon as
 * the last day of the current month scrolls out on the left.
 */
function DateStrip({ range, selected, onSelect }: Omit<DateHeaderProps, 'onHeightChange'>) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - PAGE_PAD_X * 2) / DAYS_VISIBLE;
  const { days, thisWeekIndex, todayIndex, todayKey } = range;

  const listRef = useRef<FlatList<Date>>(null);
  const leftRef = useRef(thisWeekIndex); // same as leftIndex, readable from effects without re-running them
  const [leftIndex, setLeftIndex] = useState(thisWeekIndex);
  const leftDay = days[leftIndex];
  const monthKey = `${leftDay.getFullYear()}-${leftDay.getMonth()}`;
  const monthLabel = leftDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // A day counts as visible until it's fully off the left edge (+0.01 absorbs float error at snap points).
    const i = Math.floor(e.nativeEvent.contentOffset.x / cellWidth + 0.01);
    leftRef.current = Math.min(days.length - 1, Math.max(0, i));
    setLeftIndex(leftRef.current);
  };

  // When the selection moves off-screen (e.g. scrolling the canvas into next week), bring its week into view.
  useEffect(() => {
    const i = range.indexOf.get(selected);
    if (i === undefined) return;
    if (i < leftRef.current || i >= leftRef.current + DAYS_VISIBLE) {
      listRef.current?.scrollToIndex({ index: i - range.days[i].getDay(), animated: true });
    }
  }, [selected, range]);

  const todayInView = todayIndex >= leftIndex && todayIndex < leftIndex + DAYS_VISIBLE;
  const showTodayButton = selected !== todayKey || !todayInView;

  const goToToday = () => {
    haptics.tick();
    listRef.current?.scrollToIndex({ index: thisWeekIndex, animated: true });
    onSelect(todayKey);
  };

  return (
    <View style={{ paddingHorizontal: PAGE_PAD_X }}>
      <View className="h-11 flex-row items-center justify-between px-1">
        <Animated.View key={monthKey} entering={FadeIn.duration(180)}>
          <Text className="font-rounded text-title2 text-ink font-bold">{monthLabel}</Text>
        </Animated.View>
        {showTodayButton && (
          <Pressable
            onPress={goToToday}
            hitSlop={8}
            className="bg-accent/10 rounded-full px-3 py-1 active:opacity-60"
          >
            <Text className="text-subhead text-accent font-semibold">Today</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={listRef}
        horizontal
        data={days}
        keyExtractor={dateKey}
        extraData={selected}
        getItemLayout={(_, index) => ({ length: cellWidth, offset: cellWidth * index, index })}
        initialScrollIndex={thisWeekIndex}
        initialNumToRender={DAYS_VISIBLE * 3}
        windowSize={7}
        snapToInterval={cellWidth}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const key = dateKey(item);
          return (
            <DayCell
              date={item}
              width={cellWidth}
              isToday={key === todayKey}
              isSelected={key === selected}
              onPress={() => {
                if (key !== selected) haptics.tick();
                onSelect(key);
              }}
            />
          );
        }}
      />
    </View>
  );
}

interface DayCellProps {
  date: Date;
  width: number;
  isToday: boolean;
  isSelected: boolean;
  onPress: () => void;
}

// Selected today: accent fill. Selected other day: ink fill. Today (unselected): accent text.
function DayCell({ date, width, isToday, isSelected, onPress }: DayCellProps) {
  return (
    <Pressable onPress={onPress} style={{ width }} className="items-center gap-1 pb-2 pt-0.5">
      <Text
        className={cn(
          'text-caption font-semibold uppercase',
          isToday ? 'text-accent' : 'text-subtle',
        )}
      >
        {WEEKDAYS[date.getDay()]}
      </Text>
      <View
        className={cn(
          'h-9 w-9 items-center justify-center rounded-full',
          isSelected && (isToday ? 'bg-accent' : 'bg-ink'),
        )}
      >
        <Text
          className={cn(
            'text-callout font-semibold',
            isSelected
              ? isToday
                ? 'text-on-accent'
                : 'text-app'
              : isToday
                ? 'text-accent'
                : 'text-ink',
          )}
          style={styles.tabular}
        >
          {date.getDate()}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', top: 0, left: 0, right: 0 },
  rule: { height: StyleSheet.hairlineWidth },
  tabular: { fontVariant: ['tabular-nums'] },
});
