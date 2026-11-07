import { cn } from '@planner/ui';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/lib/haptics';

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

interface Props {
  entry: TimelineEntry;
  column: number;
  columns: number;
  /** The grid's visible window: positions are relative to its start, and drags stay inside it. */
  window: TimeWindow;
  onMove: (id: string, startMin: number) => void;
  onDragChange: (dragging: boolean) => void;
}

/** One block on the timeline. Planner items can be long-pressed and dragged to a new 15-minute slot. */
export function TimelineBlock({ entry, column, columns, window, onMove, onDragChange }: Props) {
  const duration = entry.endMin - entry.startMin;
  const height = Math.max(duration, MIN_BLOCK_MIN) * PX_PER_MIN;
  const origin = window.startMin;
  const minStart = window.startMin;
  const maxStart = Math.max(minStart, window.endMin - duration);

  const top = useSharedValue((entry.startMin - origin) * PX_PER_MIN);
  const baseMin = useSharedValue(entry.startMin); // committed start, where the drag began
  const snapMin = useSharedValue(entry.startMin); // slot under the finger right now
  const active = useSharedValue(false);
  const [previewMin, setPreviewMin] = useState<number | null>(null);

  // A committed move (or a data change from sync later) springs the block to its new slot.
  // If the window itself moved (the grid grew or shrank at the top), jump instead: the hour lines
  // jump too, so a spring would make the block drift against them.
  const lastOrigin = useRef(origin);
  useEffect(() => {
    const target = (entry.startMin - origin) * PX_PER_MIN;
    baseMin.set(entry.startMin);
    snapMin.set(entry.startMin);
    top.set(lastOrigin.current === origin ? withSpring(target, SPRING) : target);
    lastOrigin.current = origin;
  }, [entry.startMin, origin, baseMin, snapMin, top]);

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
        top.set(withSpring((snapped - origin) * PX_PER_MIN, SPRING));
        scheduleOnRN(handleSnap, snapped);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled) {
        snapMin.set(baseMin.get());
        top.set(withSpring((baseMin.get() - origin) * PX_PER_MIN, SPRING));
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

  return (
    <GestureDetector gesture={pan}>
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
            planner ? 'bg-accent/15' : 'bg-subtle/20',
          )}
        >
          <View className={cn('w-1', planner ? 'bg-accent' : 'bg-subtle')} />
          <View className={cn('flex-1 px-2', compact ? 'justify-center' : 'py-1')}>
            <Text numberOfLines={compact ? 1 : 2} className="text-footnote text-ink font-semibold">
              {entry.title}
              {compact && (
                <Text className="text-muted font-normal" style={styles.tabular}>
                  {'  '}
                  {formatTime(startMin)}
                </Text>
              )}
            </Text>
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
});
