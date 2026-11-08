import { cn } from '@planner/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  useExclusiveGestures,
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

import { DOUBLE_TAP_MAX_DELAY_MS } from '@/lib/gestures';
import { haptics } from '@/lib/haptics';
import { openItem } from '@/lib/open-item';

import { Checkbox } from './checkbox';
import { ListIcon } from './list-icon';
import { follow, liftAt, type TaskDragHandlers } from './drag-layer';
import { formatTime } from './time';
import { MIN_BLOCK_MIN, PX_PER_MIN, type TimelineEntry } from './timeline-constants';

const SPRING = { damping: 22, stiffness: 320, mass: 0.6 };
const LONG_PRESS_MS = 300;
const CHECK_SIZE = 16;

interface Props {
  entry: TimelineEntry;
  column: number;
  columns: number;
  drag: TaskDragHandlers;
  /** This block is lifted: it stays in place, faded, while its floating copy moves. */
  faded: boolean;
  onToggleDone: (id: string) => void;
}

/**
 * One block on the timeline. Positioned by absolute time of day (minute 0 = top of the day), so
 * changing the grid's visible window never moves it; only moving the item itself does.
 * Planner items can be long-pressed and dragged (via the canvas's drag layer) to any slot on any
 * day, or into the Anytime list.
 */
export function TimelineBlock({ entry, column, columns, drag, faded, onToggleDone }: Props) {
  const duration = entry.endMin - entry.startMin;
  const height = Math.max(duration, MIN_BLOCK_MIN) * PX_PER_MIN;
  const { layer, onStart, onMove, onEnd } = drag;
  const width = useRef(0);

  const lift = (grabY: number, x: number) => {
    haptics.lift();
    onStart({
      kind: 'block',
      id: entry.id,
      anchorMin: grabY / PX_PER_MIN,
      x,
      width: width.current,
      height,
    });
  };

  const pan = usePanGesture({
    enabled: entry.draggable,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (e) => {
      'worklet';
      liftAt(layer, e);
      scheduleOnRN(lift, e.y, layer.x.get());
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(onMove, follow(layer, e));
    },
    onDeactivate: (e) => {
      'worklet';
      scheduleOnRN(onEnd, !!e.canceled);
    },
  });

  // A quick tap on the check toggles done. A long press still drags (the pan takes over
  // at 300ms, which cancels the tap), so the whole block stays grabbable.
  const handleToggle = () => {
    haptics.check();
    onToggleDone(entry.id);
  };
  // A single tap anywhere else on the block opens its details (it waits for a possible double tap,
  // and a tap on the check never opens it: the check's tap blocks this one).
  const openTap = useTapGesture({
    maxDuration: 250,
    onActivate: () => {
      'worklet';
      scheduleOnRN(openItem, entry.id);
    },
  });
  const tap = useTapGesture({
    enabled: entry.checkable,
    block: openTap,
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
    maxDelay: DOUBLE_TAP_MAX_DELAY_MS,
    onActivate: () => {
      'worklet';
      scheduleOnRN(handleToggle);
    },
  });
  const taps = useExclusiveGestures(doubleTap, openTap);
  const blockGesture = useCompetingGestures(pan, taps);

  const startMin = entry.startMin;
  const compact = height < 40;
  const planner = entry.tone === 'planner';
  const done = entry.done;

  return (
    <GestureDetector gesture={blockGesture}>
      <View
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        style={[
          styles.block,
          {
            top: startMin * PX_PER_MIN,
            height,
            left: `${(column / columns) * 100}%`,
            width: `${100 / columns}%`,
            opacity: faded ? 0.35 : 1,
          },
        ]}
      >
        <BlockBody
          title={entry.title}
          startMin={startMin}
          endMin={startMin + duration}
          compact={compact}
          planner={planner}
          done={done}
          isList={entry.isList}
          check={
            entry.checkable && (
              <GestureDetector gesture={tap}>
                <View className="items-end justify-center pl-2" style={styles.checkTarget}>
                  <Checkbox done={done} size={CHECK_SIZE} />
                </View>
              </GestureDetector>
            )
          }
        />
      </View>
    </GestureDetector>
  );
}

interface BlockBodyProps {
  title: string;
  startMin: number;
  endMin: number;
  compact: boolean;
  /** Our own item (accent) vs a read-only calendar event (grey). */
  planner: boolean;
  done: boolean;
  /** The check, drawn at the right of the title row (planner items only). */
  check?: ReactNode;
  /** A list: a small list icon follows the title. */
  isList?: boolean;
}

/** A block's look: tinted card, coloured stripe, title row (title … check) and the time. */
export function BlockBody({
  title,
  startMin,
  endMin,
  compact,
  planner,
  done,
  check,
  isList = false,
}: BlockBodyProps) {
  return (
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
            {title}
          </Text>
          {isList && <ListIcon />}
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
          {check}
        </View>
        {!compact && (
          <Text numberOfLines={1} className="text-caption text-muted" style={styles.tabular}>
            {formatTime(startMin)} – {formatTime(endMin)}
          </Text>
        )}
      </View>
    </View>
  );
}

export interface DropPreview {
  title: string;
  startMin: number;
  endMin: number;
  /** Still held by the finger (lifted look) vs dropped and settling in. */
  lifted: boolean;
  isList?: boolean;
}

/**
 * Where a dragged Anytime task would land: a block at its absolute time of day, over the others,
 * springing from slot to slot as the finger moves.
 */
export function PreviewBlock({ title, startMin, endMin, lifted, isList }: DropPreview) {
  const height = Math.max(endMin - startMin, MIN_BLOCK_MIN) * PX_PER_MIN;
  const top = useSharedValue(startMin * PX_PER_MIN);
  useEffect(() => {
    top.set(withSpring(startMin * PX_PER_MIN, SPRING));
  }, [startMin, top]);

  const style = useAnimatedStyle(() => ({
    top: top.get(),
    shadowOpacity: withTiming(lifted ? 0.18 : 0, { duration: 150 }),
    transform: [{ scale: withSpring(lifted ? 1.03 : 1, SPRING) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.block, styles.preview, { height }, style]}>
      <BlockBody
        title={title}
        startMin={startMin}
        endMin={endMin}
        compact={height < 40}
        planner
        done={false}
        isList={isList}
        check={
          <View className="items-end justify-center pl-2" style={styles.checkTarget}>
            <Checkbox done={false} size={CHECK_SIZE} />
          </View>
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { position: 'absolute', paddingRight: 2, paddingBottom: 2 },
  // Only the preview lifts off the grid (its shadowOpacity is animated).
  preview: {
    left: 0,
    right: 0,
    zIndex: 30,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  tabular: { fontVariant: ['tabular-nums'] },
  // Matches text-footnote's line height, so the check never makes the row taller than the title.
  titleRow: { height: 18 },
  checkTarget: { height: 18 },
});
