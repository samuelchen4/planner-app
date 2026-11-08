import { cn } from '@planner/ui';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/lib/haptics';

import { Checkbox } from './checkbox';
import type { AnytimeTask } from './day-entries';
import { follow, liftAt, type TaskDragHandlers } from './drag-layer';
import { PopIn } from './morph';

// A day's all-day tasks sit above its grid card, straight on the page (no card around them); with
// none, a "No all-day tasks" box one task tall. Fixed heights (the canvas computes day heights from
// these; keep them in sync with the JSX).
export const ANYTIME_ROW_H = 32;
export const ANYTIME_ROW_GAP = 6;
/** Space above the first row (none: the rows aren't in a card). */
export const ANYTIME_PAD = 0;
/** Space between the all-day card and the grid card below it. */
export const ANYTIME_BOTTOM = 8;
/** The empty box is exactly one task tall, so a first drop doesn't move anything. */
export const ANYTIME_EMPTY_H = ANYTIME_ROW_H;
/** Where the rows start, from the page column's left edge. */
export const ANYTIME_LANE_LEFT = 0;
/** The rows are narrower than the page column by this much. */
export const ANYTIME_LANE_INSET = 0;

/** Height of a day's all-day tasks (the empty box when 0), gap below included. */
export const anytimeHeight = (n: number) =>
  (n === 0 ? ANYTIME_EMPTY_H : n * ANYTIME_ROW_H + (n - 1) * ANYTIME_ROW_GAP) + ANYTIME_BOTTOM;

/** Offset of row i's top inside the section. */
export const anytimeRowTop = (i: number) => ANYTIME_PAD + i * (ANYTIME_ROW_H + ANYTIME_ROW_GAP);

const LONG_PRESS_MS = 300;
const CHECK_SIZE = 16;

/** An all-day task's look (like a grid block, without a time). Shared with the floating copy. */
export function AnytimeRowBody({ title, done }: { title: string; done: boolean }) {
  return (
    <View
      className={cn(
        'flex-1 flex-row overflow-hidden rounded-lg',
        done ? 'bg-done/15' : 'bg-accent/15',
      )}
    >
      <View className={cn('w-1', done ? 'bg-done' : 'bg-accent')} />
      <View className="flex-1 flex-row items-center pl-2 pr-1.5">
        <Text
          numberOfLines={1}
          className={cn(
            'text-footnote shrink font-semibold',
            done ? 'text-muted line-through' : 'text-ink',
          )}
        >
          {title}
        </Text>
        <View className="flex-1" />
        <View className="pl-2">
          <Checkbox done={done} size={CHECK_SIZE} />
        </View>
      </View>
    </View>
  );
}

interface Props {
  tasks: AnytimeTask[];
  onToggleDone: (id: string) => void;
  drag: TaskDragHandlers;
  /** A task is being dragged: an empty card shows as a drop box. */
  dragActive: boolean;
  /** The task being dragged: its row stays in place, faded, until the drop. */
  draggingId: string | null;
  /** A held task would land here, at this position (a line between rows), or null. */
  insertAt: number | null;
  /** Just dropped elsewhere: this row collapses as `removeProgress` goes 0 → 1. */
  removingId: string | null;
  removeProgress: SharedValue<number>;
  /** Just dropped here: this row grows in as `addProgress` goes 0 → 1. */
  addingId: string | null;
  addProgress: SharedValue<number>;
  /** Its last task just left: the empty box pops in rather than just appearing. */
  emptyAppear: boolean;
}

/**
 * A day's all-day (untimed) tasks. Double-tap a task to
 * check it off; long-press to drag it onto a grid or another day. Tasks and blocks dropped here
 * lose their time. Empty: a "No all-day tasks" card, a drop box while dragging.
 */
export function AnytimeList({
  tasks,
  onToggleDone,
  drag,
  dragActive,
  draggingId,
  insertAt,
  removingId,
  removeProgress,
  addingId,
  addProgress,
  emptyAppear,
}: Props) {
  const highlighted = insertAt !== null;
  if (tasks.length === 0) {
    return (
      <View style={{ paddingBottom: ANYTIME_BOTTOM }}>
        {dragActive ? (
          <DropBox
            label="Drop here for all day"
            highlighted={highlighted}
            style={{ height: ANYTIME_EMPTY_H }}
          />
        ) : (
          <EmptyAllDay animate={emptyAppear} />
        )}
      </View>
    );
  }
  return (
    <View style={{ paddingBottom: ANYTIME_BOTTOM }}>
      <View>
        {insertAt !== null && (
          // Drawn in the gap where the task would go (over the layout, nothing moves).
          <View
            pointerEvents="none"
            className="bg-accent absolute left-0 right-0 z-10 rounded-full"
            style={{
              height: 3,
              top: insertAt * (ANYTIME_ROW_H + ANYTIME_ROW_GAP) - ANYTIME_ROW_GAP / 2 - 1.5,
            }}
          />
        )}
        {tasks.map((task, i) => (
          <AnytimeRow
            key={task.id}
            task={task}
            first={i === 0}
            onToggleDone={onToggleDone}
            drag={drag}
            faded={task.id === draggingId}
            // Rows collapse out / grow in; a first task replacing the empty box (same height) pops
            // in from its centre instead.
            motion={
              task.id === removingId && tasks.length > 1
                ? 'removing'
                : task.id === addingId
                  ? tasks.length > 1
                    ? 'adding'
                    : 'appear'
                  : null
            }
            progress={task.id === removingId ? removeProgress : addProgress}
          />
        ))}
      </View>
    </View>
  );
}

function EmptyAllDay({ animate }: { animate: boolean }) {
  const card = <EmptyCard label="No all-day tasks" height={ANYTIME_EMPTY_H} />;
  return animate ? <PopIn>{card}</PopIn> : card;
}

/**
 * An empty placeholder ("No all-day tasks", "Nothing scheduled"): no fill, just a thin outline, so
 * empty days don't read as big blocks. While dragging it's swapped for a dashed DropBox (same size).
 */
export function EmptyCard({ label, height }: { label: string; height: number }) {
  return (
    <View
      style={{ height, borderWidth: StyleSheet.hairlineWidth }}
      className="border-border items-center justify-center rounded-2xl"
    >
      <Text className="text-footnote text-subtle">{label}</Text>
    </View>
  );
}

/** A dotted drop zone standing in for an empty card while a task is dragged. */
export function DropBox({
  label,
  highlighted,
  style,
}: {
  label: string;
  highlighted: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={style}
      className={cn(
        'items-center justify-center rounded-2xl border border-dashed',
        highlighted ? 'border-accent bg-accent/10' : 'border-border',
      )}
    >
      <Text className={cn('text-footnote', highlighted ? 'text-accent' : 'text-subtle')}>
        {label}
      </Text>
    </View>
  );
}

interface RowProps {
  task: AnytimeTask;
  first: boolean;
  onToggleDone: (id: string) => void;
  drag: TaskDragHandlers;
  faded: boolean;
  /** Collapsing out (removing), growing in (adding) or popping in (appear) as `progress` goes 0 → 1. */
  motion: 'removing' | 'adding' | 'appear' | null;
  progress: SharedValue<number>;
}

function AnytimeRow({ task, first, onToggleDone, drag, faded, motion, progress }: RowProps) {
  const { layer, onStart, onMove, onEnd } = drag;
  const gap = first ? 0 : ANYTIME_ROW_GAP;

  const toggle = () => {
    haptics.check();
    onToggleDone(task.id);
  };
  const lift = () => {
    haptics.lift();
    onStart({ kind: 'anytime', id: task.id });
  };

  // Double-tap toggles done (a single tap does nothing, so scrolling past can't check it off).
  const tap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 300,
    onActivate: () => {
      'worklet';
      scheduleOnRN(toggle);
    },
  });
  const pan = usePanGesture({
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (e) => {
      'worklet';
      liftAt(layer, e);
      scheduleOnRN(lift);
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
  const gesture = useCompetingGestures(pan, tap);

  // Collapsing (or growing in): the row and the gap it brings scale with `shown` (1 = full). The
  // first row has no gap above it, so it pulls the next row up by one gap instead.
  const rowStyle = useAnimatedStyle(() => {
    if (!motion) {
      return {
        height: ANYTIME_ROW_H + gap,
        marginBottom: 0,
        opacity: 1,
        transform: [{ scale: 1 }],
      };
    }
    if (motion === 'appear') {
      const p = progress.get();
      return {
        height: ANYTIME_ROW_H + gap,
        marginBottom: 0,
        opacity: p,
        transform: [{ scale: 0.92 + 0.08 * p }],
      };
    }
    const shown = motion === 'removing' ? 1 - progress.get() : progress.get();
    return {
      height: (ANYTIME_ROW_H + gap) * shown,
      marginBottom: first ? -ANYTIME_ROW_GAP * (1 - shown) : 0,
      opacity: shown,
      transform: [{ scale: 1 }],
    };
  });

  return (
    <Animated.View style={[{ paddingTop: gap, overflow: 'hidden' }, rowStyle]}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityHint="Long-press and drag onto the schedule to give it a time"
          style={{ height: ANYTIME_ROW_H, opacity: faded ? 0.35 : 1 }}
        >
          <AnytimeRowBody title={task.title} done={task.done} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
