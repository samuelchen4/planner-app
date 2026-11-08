import type { PlannerItem } from '@planner/core';
import { cn, noteColors } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, useExclusiveGestures, useTapGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { ANYTIME_ROW_GAP, ANYTIME_ROW_H, AnytimeRowBody } from '@/features/day-view/anytime-list';
import { Checkbox } from '@/features/day-view/checkbox';
import { GestureScrollView } from '@/lib/gesture-scroll-view';
import { DOUBLE_TAP_MAX_DELAY_MS } from '@/lib/gestures';
import { haptics } from '@/lib/haptics';
import { openItem } from '@/lib/open-item';
import { useColors, useScheme } from '@/lib/theme';

/** Items sit one to a row, like the Today screen's all-day tasks (same chip, same height). */
const ROW_H = ANYTIME_ROW_H;
const GAP = ANYTIME_ROW_GAP;
/**
 * The items area stops at five and a half rows, then scrolls inside the note. The half row cut
 * off at the bottom shows there's more.
 */
const MAX_ITEMS_H = 5.5 * ROW_H + 5 * GAP;
/** Sticky notes are squarer than the app's cards. */
const NOTE_RADIUS = 14;

const ITEM_CHECK = 16;
const LIST_CHECK = 22;

/**
 * Gestures shared by lists and their entries, the same as tasks on the Today screen: a quick tap
 * on the check toggles, and a double tap anywhere on the row toggles. With `onOpen`, a single tap
 * elsewhere opens the details (it waits for a possible double tap; a tap on the check never
 * opens). Without it, a single tap elsewhere does nothing.
 */
function useRowGestures(onToggle: () => void, onOpen?: () => void) {
  const toggle = () => {
    haptics.check();
    onToggle();
  };
  const open = () => onOpen?.();
  const openTap = useTapGesture({
    enabled: onOpen !== undefined,
    maxDuration: 250,
    onActivate: () => {
      'worklet';
      scheduleOnRN(open);
    },
  });
  const checkTap = useTapGesture({
    block: openTap,
    maxDuration: 250,
    // The check is drawn small; the touch area reaches ~44pt.
    hitSlop: { top: 6, bottom: 6, left: 4, right: 6 },
    onActivate: () => {
      'worklet';
      scheduleOnRN(toggle);
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: DOUBLE_TAP_MAX_DELAY_MS,
    onActivate: () => {
      'worklet';
      scheduleOnRN(toggle);
    },
  });
  const rowGesture = useExclusiveGestures(doubleTap, openTap);
  return { checkTap, rowGesture };
}

function ListItemRow({ item, onToggle }: { item: PlannerItem; onToggle: () => void }) {
  const { checkTap, rowGesture } = useRowGestures(onToggle);
  const done = item.status === 'done';
  return (
    <GestureDetector gesture={rowGesture}>
      <View
        accessible
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        // An opaque backing, so the tinted chip looks the same as on the Today screen whatever the
        // note's colour (the tint would otherwise mix with the paper).
        className="bg-card rounded-lg"
        style={{ height: ROW_H }}
      >
        <AnytimeRowBody
          title={item.title}
          done={done}
          check={
            <GestureDetector gesture={checkTap}>
              <View className="h-full items-end justify-center pl-2">
                <Checkbox done={done} size={ITEM_CHECK} />
              </View>
            </GestureDetector>
          }
        />
      </View>
    </GestureDetector>
  );
}

interface Props {
  /** The list (a planner item of type 'list'). */
  list: PlannerItem;
  items: PlannerItem[];
  /** When it's on the planner ('Today', 'Tomorrow, 2:00 PM'); null when it has no date. */
  when: string | null;
  onToggleList: (id: string) => void;
  onToggleItem: (id: string) => void;
}

/**
 * A list, drawn as a sticky note in its colour (paper fill, a clear edge): its title with its own
 * check (independent of the items), then its items one to a row. Past MAX_ITEMS_H the items scroll
 * inside the note.
 */
export function ListCard({ list, items, when, onToggleList, onToggleItem }: Props) {
  const { checkTap, rowGesture } = useRowGestures(
    () => onToggleList(list.id),
    () => openItem(list.id),
  );
  const done = list.status === 'done';
  const open = items.filter((i) => i.status !== 'done').length;
  const note = noteColors[useScheme()][list.color ?? 'yellow'];
  const colors = useColors();

  return (
    <View
      className="gap-3 px-3 pb-3 pt-3.5 shadow-sm shadow-black/10"
      style={[styles.note, { backgroundColor: note.paper, borderColor: note.edge }]}
    >
      <GestureDetector gesture={rowGesture}>
        <View
          accessible
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          className="flex-row items-center gap-2 px-1"
        >
          <Text
            numberOfLines={1}
            className={cn(
              'text-headline shrink font-semibold',
              done ? 'text-muted line-through' : 'text-ink',
            )}
          >
            {list.title}
          </Text>
          <Text className="text-footnote text-subtle" style={{ fontVariant: ['tabular-nums'] }}>
            {open === 0 ? 'All done' : `${open} left`}
          </Text>
          {when && (
            // On the planner (so it's also on the Today screen): just an icon for now, the date
            // itself is read out to VoiceOver. Where to show the full date is still open.
            <View accessible accessibilityLabel={when}>
              <SymbolView name="calendar" size={13} tintColor={colors.muted} />
            </View>
          )}
          <View className="flex-1" />
          <GestureDetector gesture={checkTap}>
            <View className="items-end justify-center py-1 pl-3">
              <Checkbox done={done} size={LIST_CHECK} />
            </View>
          </GestureDetector>
        </View>
      </GestureDetector>

      {items.length === 0 ? (
        <View
          className="items-center justify-center rounded-lg"
          style={{ height: ROW_H, borderWidth: StyleSheet.hairlineWidth, borderColor: note.edge }}
        >
          <Text className="text-footnote text-subtle">No items</Text>
        </View>
      ) : (
        <GestureScrollView
          style={{ maxHeight: MAX_ITEMS_H }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={{ rowGap: GAP }}>
            {items.map((item) => (
              <ListItemRow key={item.id} item={item} onToggle={() => onToggleItem(item.id)} />
            ))}
          </View>
        </GestureScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: NOTE_RADIUS, borderWidth: 1.5 },
});
