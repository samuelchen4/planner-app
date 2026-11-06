import type { DayEntry } from '@planner/core';
import { Card } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';

import { mockDayEntries } from './mock-data';

// Placeholder day view: proves tokens, NativeWind, SF Symbols and shared types work end to end.
// The real timeline gets designed and built in the next step.
export function DayViewScreen() {
  const colors = useColors();
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-8 pt-4">
      <View>
        <Text className="text-subhead font-medium uppercase text-muted">{dateLabel}</Text>
        <Text className="text-large-title font-bold text-ink">Today</Text>
      </View>

      <Card>
        <View className="mb-1 flex-row items-center gap-1.5">
          <SymbolView name="calendar" size={14} tintColor={colors.muted} />
          <Text className="text-subhead font-medium text-muted">Schedule</Text>
        </View>
        {mockDayEntries.map((entry, i) => (
          <EntryRow key={entryId(entry)} entry={entry} isFirst={i === 0} />
        ))}
      </Card>
    </ScrollView>
  );
}

function EntryRow({ entry, isFirst }: { entry: DayEntry; isFirst: boolean }) {
  const colors = useColors();
  const title = entry.kind === 'item' ? entry.item.title : entry.event.title;
  const start = entry.kind === 'item' ? entry.item.startAt : entry.event.startAt;
  const source = entry.kind === 'external' ? 'Google' : entry.item.type.replace('_', ' ');

  return (
    <View
      className="flex-row items-center justify-between py-3"
      style={isFirst ? undefined : [styles.divider, { borderTopColor: colors.border }]}>
      <View>
        <Text className="text-headline font-semibold text-ink">{title}</Text>
        <Text className="text-footnote capitalize text-muted">{source}</Text>
      </View>
      <Text className="text-subhead text-muted" style={styles.tabular}>
        {start ? start.slice(11, 16) : 'Anytime'}
      </Text>
    </View>
  );
}

const entryId = (e: DayEntry) => (e.kind === 'item' ? e.item.id : e.event.id);

const styles = StyleSheet.create({
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  tabular: { fontVariant: ['tabular-nums'] },
});
