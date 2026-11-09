import { useMemo } from 'react';
import { Text } from 'react-native';

import { useTabBarSpace } from '@/features/tabs/glass-tab-bar';
import { useTabBarScrollTracker } from '@/features/tabs/tab-bar-scroll';
import { GestureScrollView } from '@/lib/gesture-scroll-view';
import { toggleHabitDay } from '@/db/habits';
import { useHabitDays, useTasks } from '@/db/tables';

import { HabitCard } from './habit-card';
import { doneByHabit, recentDays, streak } from './habit-days';

const NONE = new Set<string>();

/**
 * Habits: things done every day, with no time. Each habit shows the last 7 days as dots to check
 * off, and its current streak. Habits only live here (not on the Today screen).
 */
export function HabitsScreen() {
  const tabBarSpace = useTabBarSpace();
  const tracker = useTabBarScrollTracker();
  const tasks = useTasks();
  const habitDays = useHabitDays();

  const today = new Date();
  const days = recentDays(today);
  const habits = useMemo(
    () => tasks.filter((t) => t.type === 'habit' && t.status !== 'cancelled'),
    [tasks],
  );
  const byHabit = useMemo(() => doneByHabit(habitDays), [habitDays]);

  return (
    <GestureScrollView
      className="bg-app flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-3 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
      scrollEventThrottle={16}
      onScrollBeginDrag={(e) => tracker.onBegin(e.nativeEvent.contentOffset.y)}
      onScroll={(e) => tracker.onScroll(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={() => tracker.onEnd()}
      onMomentumScrollBegin={(e) => tracker.onBegin(e.nativeEvent.contentOffset.y)}
      onMomentumScrollEnd={() => tracker.onEnd()}
    >
      <Text className="font-rounded text-large-title text-ink mb-1 font-bold">Habits</Text>
      {habits.map((habit) => {
        const done = byHabit.get(habit.id) ?? NONE;
        return (
          <HabitCard
            key={habit.id}
            habit={habit}
            days={days}
            today={today}
            done={done}
            streak={streak(done, today)}
            onToggleDay={(day) => toggleHabitDay(habit, day)}
          />
        );
      })}
    </GestureScrollView>
  );
}
