import { useMemo } from 'react';
import { Text } from 'react-native';

import { useTabBarSpace } from '@/features/tabs/glass-tab-bar';
import { useTabBarScrollTracker } from '@/features/tabs/tab-bar-scroll';
import {
  dateKey,
  formatTime,
  minutesOfDay,
  parseDateKey,
  relativeDayName,
} from '@/features/day-view/time';
import { GestureScrollView } from '@/lib/gesture-scroll-view';
import type { Task } from '@/db/schema';
import { useTasks } from '@/db/tables';
import { toggleDone } from '@/db/tasks';

import { ListCard } from './list-card';

/** When a list is on the planner: 'Today', 'Tomorrow, 2:00 PM', 'Mon, Nov 16' (null: no date). */
function whenLabel(list: Task): string | null {
  const key = list.start_at ? dateKey(new Date(list.start_at)) : list.all_day_date;
  if (!key) return null;
  const name = relativeDayName(parseDateKey(key));
  return list.start_at ? `${name}, ${formatTime(minutesOfDay(list.start_at))}` : name;
}

/**
 * Lists: every list (a task of type 'list') with its entries. The same tasks as the Today screen,
 * so a dated list ticked here is ticked there too.
 */
export function ListsScreen() {
  const tabBarSpace = useTabBarSpace();
  const tracker = useTabBarScrollTracker();
  const tasks = useTasks();

  const { lists, entriesByList } = useMemo(() => {
    const lists: Task[] = [];
    const entriesByList = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.status === 'cancelled') continue;
      if (task.type === 'list') lists.push(task);
      else if (task.list_id) {
        entriesByList.set(task.list_id, [...(entriesByList.get(task.list_id) ?? []), task]);
      }
    }
    return { lists, entriesByList };
  }, [tasks]);

  return (
    <GestureScrollView
      className="bg-app flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
      scrollEventThrottle={16}
      onScrollBeginDrag={(e) => tracker.onBegin(e.nativeEvent.contentOffset.y)}
      onScroll={(e) => tracker.onScroll(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={() => tracker.onEnd()}
      onMomentumScrollBegin={(e) => tracker.onBegin(e.nativeEvent.contentOffset.y)}
      onMomentumScrollEnd={() => tracker.onEnd()}
    >
      <Text className="font-rounded text-large-title text-ink font-bold">Lists</Text>
      {lists.map((list) => (
        <ListCard
          key={list.id}
          list={list}
          items={entriesByList.get(list.id) ?? []}
          when={whenLabel(list)}
          onToggleList={toggleDone}
          onToggleItem={toggleDone}
        />
      ))}
    </GestureScrollView>
  );
}
