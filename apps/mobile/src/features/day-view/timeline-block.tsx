import { cn } from '@planner/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/lib/haptics';

import { Checkbox } from './checkbox';
import { formatTime } from './time';
import {
  MIN_BLOCK_MIN,
  PX_PER_MIN,
  SNAP_MIN,
  type TimelineEntry,
  type TimeWindow,
} from './timeline-constants';

const SPRING = { damping: 22, stiffness: 320, mass: 0.6 };
const LONG_PRESS_MS = 300;
const CHECK_SIZE = 16;

interface Props {
  entry: TimelineEntry;
  column: number;
  columns: number;
  /** The grid's visible window: drags stay inside it. */
  window: TimeWindow;
  onMove: (id: string, startMin: number) => void;
  onToggleDone: (id: string) => void;
  onDragChange: (dragging: boolean) => void;
}

/**
 * One block on the timeline. Planner items can be long-pressed and dragged to a new 15-minute slot.
 * Positioned by absolute time of day (minute 0 = top of the day), so changing the grid's visible
 * window never moves it; only moving the item itself does.
 */
export function TimelineBlock({
  entry,
  column,
  columns,
  window,
  onMove,
  onToggleDone,
  onDragChange,
}: Props) {
  const duration = entry.endMin - entry.startMin;
  const height = Math.max(duration, MIN_BLOCK_MIN) * PX_PER_MIN;
  const minStart = window.startMin;
  const maxStart = Math.max(minStart, window.endMin - duration);

  const top = useSharedValue(entry.startMin * PX_PER_MIN);
  const baseMin = useSharedValue(entry.startMin); // committed start, where the drag began
  const snapMin = useSharedValue(entry.startMin); // slot under the finger right now
  const active = useSharedValue(false);
  const [previewMin, setPreviewMin] = useState<number | null>(null);

  // A committed move (or a data change from sync later) springs the block to its new slot.
  useEffect(() => {
    baseMin.set(entry.startMin);
    snapMin.set(entry.startMin);
    top.set(withSpring(entry.startMin * PX_PER_MIN, SPRING));
  }, [entry.startMin, baseMin, snapMin, top]);

  const handleLift = () => {
    haptics.lift();
    onDragChange(true);
    setPreviewMin(entry.startMin);
  };
  const handleSnap = (minutes: number) => {
    haptics.tick();
    setPreviewMin(minutes);
  };
  const handleDrop = (minutes: number | null) => {
    onDragChange(false);
    setPreviewMin(null);
    if (minutes !== null && minutes !== entry.startMin) onMove(entry.id, minutes);
  };

  const pan = usePanGesture({
    enabled: entry.draggable,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: () => {
      'worklet';
      active.set(true);
      scheduleOnRN(handleLift);
    },
    onUpdate: (e) => {
      'worklet';
      const raw = baseMin.get() + e.translationY / PX_PER_MIN;
      const snapped = Math.min(maxStart, Math.max(minStart, Math.round(raw / SNAP_MIN) * SNAP_MIN));
      if (snapped !== snapMin.get()) {
        snapMin.set(snapped);
        top.set(withSpring(snapped * PX_PER_MIN, SPRING));
        scheduleOnRN(handleSnap, snapped);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled) {
        snapMin.set(baseMin.get());
        top.set(withSpring(baseMin.get() * PX_PER_MIN, SPRING));
        scheduleOnRN(handleDrop, null);
      } else {
        scheduleOnRN(handleDrop, snapMin.get());
      }
    },
    onFinalize: () => {
      'worklet';
      active.set(false);
    },
  });

  // A quick tap on the check toggles done. A long press still drags (the pan takes over
  // at 300ms, which cancels the tap), so the whole block stays grabbable.
  const handleToggle = () => {
    haptics.check();
    onToggleDone(entry.id);
  };
  const tap = useTapGesture({
    enabled: entry.checkable,
    maxDuration: 250,
    // The check is drawn small; the touch area reaches ~44pt.
    hitSlop: { top: 13, bottom: 13, left: 4, right: 8 },
    onActivate: () => {
      'worklet';
      scheduleOnRN(handleToggle);
    },
  });

  // Double-tap anywhere on the block toggles done too (a bigger target than the check). It competes
  // with the long-press drag: whichever recognizes first wins, and a quick double tap never lasts
  // long enough to start a drag.
  const doubleTap = useTapGesture({
    enabled: entry.checkable,
    numberOfTaps: 2,
    maxDelay: 300,
    onActivate: () => {
      'worklet';
      scheduleOnRN(handleToggle);
    },
  });
  const blockGesture = useCompetingGestures(pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    top: top.get(),
    zIndex: active.get() ? 10 : 1,
    shadowOpacity: withTiming(active.get() ? 0.18 : 0, { duration: 150 }),
    transform: [{ scale: withSpring(active.get() ? 1.03 : 1, SPRING) }],
  }));

  const startMin = previewMin ?? entry.startMin;
  const timeLabel = `${formatTime(startMin)} – ${formatTime(startMin + duration)}`;
  const compact = height < 40;
  const planner = entry.tone === 'planner';
  const done = entry.done;

  return (
    <GestureDetector gesture={blockGesture}>
      <Animated.View
        style={[
          styles.block,
          { height, left: `${(column / columns) * 100}%`, width: `${100 / columns}%` },
          animatedStyle,
        ]}
      >
        <View
          className={cn(
            'flex-1 flex-row overflow-hidden rounded-lg',
            !planner ? 'bg-subtle/20' : done ? 'bg-done/15' : 'bg-accent/15',
          )}
        >
          <View className={cn('w-1', !planner ? 'bg-subtle' : done ? 'bg-done' : 'bg-accent')} />
          <View className={cn('flex-1 pl-2 pr-1.5', compact ? 'justify-center' : 'py-1')}>
            {/* Title row: the title takes what's left and truncates; the check sits at its right,
                no taller than the title line. Compact blocks fit the start time in here too. */}
            <View className="flex-row items-center" style={styles.titleRow}>
              <Text
                numberOfLines={1}
                className={cn(
                  'text-footnote shrink font-semibold',
                  done ? 'text-muted line-through' : 'text-ink',
                )}
              >
                {entry.title}
              </Text>
              {compact && (
                <Text
                  numberOfLines={1}
                  className="text-footnote text-muted ml-1.5"
                  style={styles.tabular}
                >
                  {formatTime(startMin)}
                </Text>
              )}
              <View className="flex-1" />
              {entry.checkable && (
                <GestureDetector gesture={tap}>
                  <View className="items-end justify-center pl-2" style={styles.checkTarget}>
                    <Checkbox done={done} size={CHECK_SIZE} />
                  </View>
                </GestureDetector>
              )}
            </View>
            {!compact && (
              <Text numberOfLines={1} className="text-caption text-muted" style={styles.tabular}>
                {timeLabel}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    paddingRight: 2,
    paddingBottom: 2,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  tabular: { fontVariant: ['tabular-nums'] },
  // Matches text-footnote's line height, so the check never makes the row taller than the title.
  titleRow: { height: 18 },
  checkTarget: { height: 18 },
});
