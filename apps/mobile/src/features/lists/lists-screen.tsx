import type { PlannerItem } from '@planner/core';
import { useMemo } from 'react';
import { Text } from 'react-native';

import { useTabBarSpace } from '@/features/tabs/glass-tab-bar';
import { useTabBarScrollTracker } from '@/features/tabs/tab-bar-scroll';
import { toggleItemDone } from '@/features/day-view/day-entries';
import { addDays, dateKey, formatTime, minutesOfDay } from '@/features/day-view/time';
import { GestureScrollView } from '@/lib/gesture-scroll-view';
import { usePlannerStore } from '@/lib/planner-store';

import { ListCard } from './list-card';

/** When a list is on the planner: 'Today', 'Tomorrow, 2:00 PM', 'Mon, Nov 16' (null: no date). */
function whenLabel(list: PlannerItem): string | null {
  const key = list.startAt ? dateKey(new Date(list.startAt)) : list.allDayDate;
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date();
  const offset = Math.round((day.getTime() - addDays(today, 0).getTime()) / 86_400_000);
  const name =
    offset === 0
      ? 'Today'
      : offset === 1
        ? 'Tomorrow'
        : offset === -1
          ? 'Yesterday'
          : day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return list.startAt ? `${name}, ${formatTime(minutesOfDay(list.startAt))}` : name;
}

/**
 * Lists: every list (a planner item of type 'list') with its entries. Shares the planner store with
 * the Today screen, so a dated list ticked here is ticked there too.
 */
export function ListsScreen() {
  const tabBarSpace = useTabBarSpace();
  const tracker = useTabBarScrollTracker();
  const { entries, setEntries } = usePlannerStore();

  const { lists, entriesByList } = useMemo(() => {
    const lists: PlannerItem[] = [];
    const entriesByList = new Map<string, PlannerItem[]>();
    for (const e of entries) {
      if (e.kind !== 'item' || e.item.status === 'cancelled') continue;
      const { item } = e;
      if (item.type === 'list') lists.push(item);
      else if (item.listId) {
        entriesByList.set(item.listId, [...(entriesByList.get(item.listId) ?? []), item]);
      }
    }
    return { lists, entriesByList };
  }, [entries]);
  const toggle = (id: string) => setEntries((prev) => toggleItemDone(prev, id));

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
          onToggleList={toggle}
          onToggleItem={toggle}
        />
      ))}
    </GestureScrollView>
  );
}
