import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { usePlannerStore } from '@/lib/planner-store';

/**
 * The details of one planner item or calendar event, shown in a native sheet over the current
 * screen (see the root layout). Scaffold only: what it shows and how it edits is still being
 * decided. Decided so far: one view for every kind of item (fields shown per type), edits apply
 * instantly (no Save button), a task can gain entries ("Add items") and become a list, and a
 * list's entries are edited here.
 */
export function ItemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries } = usePlannerStore();
  const entry = entries.find((e) => (e.kind === 'item' ? e.item.id : e.event.id) === id);
  const title = entry ? (entry.kind === 'item' ? entry.item.title : entry.event.title) : null;

  return (
    <ScrollView
      className="bg-app flex-1"
      contentContainerClassName="gap-2 px-5 pt-8 pb-10"
      // Lets the sheet grow to full height when the content is scrolled up from the top.
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="font-rounded text-title2 text-ink font-bold" numberOfLines={2}>
        {title ?? 'Not found'}
      </Text>
      <View className="border-border rounded-card mt-4 h-40 items-center justify-center border border-dashed">
        <Text className="text-footnote text-subtle">Details coming soon</Text>
      </View>
    </ScrollView>
  );
}
