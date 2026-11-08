import { cn } from '@planner/ui';
import { Text, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/lib/haptics';

import { Checkbox } from './checkbox';
import type { AnytimeTask } from './day-entries';
import { follow, liftAt, type TaskDragHandlers } from './drag-layer';

// Fixed heights (the canvas computes day heights from these; keep them in sync with the JSX).
export const ANYTIME_LABEL_H = 24;
export const ANYTIME_ROW_H = 48;
export const ANYTIME_ROW_GAP = 8;
export const ANYTIME_BOTTOM = 12;

/**
 * Height of a day's Anytime section with n tasks when it's shown (only today's shows when empty,
 * as one hint row, so 0 tasks is as tall as 1).
 */
export const anytimeHeight = (n: number) => {
  const rows = Math.max(1, n);
  return ANYTIME_LABEL_H + rows * ANYTIME_ROW_H + (rows - 1) * ANYTIME_ROW_GAP + ANYTIME_BOTTOM;
};

/** Offset of row i's top inside the section. */
export const anytimeRowTop = (i: number) => ANYTIME_LABEL_H + i * (ANYTIME_ROW_H + ANYTIME_ROW_GAP);

const LONG_PRESS_MS = 300;

/** The row's look, shared with the floating copy while it's dragged. */
export function AnytimeRowBody({ title, done }: { title: string; done: boolean }) {
  return (
    <View className="bg-card flex-1 flex-row items-center gap-3 rounded-2xl px-4 shadow-sm shadow-black/5">
      <Checkbox done={done} />
      <Text
        numberOfLines={1}
        className={cn('text-body flex-1', done ? 'text-muted line-through' : 'text-ink')}
      >
        {title}
      </Text>
    </View>
  );
}

interface Props {
  tasks: AnytimeTask[];
  /** Today's list is always shown (a hint row when empty); other days only while needed. */
  isToday: boolean;
  onToggleDone: (id: string) => void;
  drag: TaskDragHandlers;
  /** The task being dragged: its row stays in place, faded, until the drop. */
  draggingId: string | null;
  /** A task is being held over this section: it would land here. */
  highlighted: boolean;
  /** Just dropped elsewhere: this row collapses as `removeProgress` goes 0 → 1. */
  removingId: string | null;
  removeProgress: SharedValue<number>;
  /** Just dropped here: this row grows in as `addProgress` goes 0 → 1. */
  addingId: string | null;
  addProgress: SharedValue<number>;
  /** Where a held task would be inserted (a line between rows), or null. */
  insertAt: number | null;
}

/**
 * A day's untimed tasks. Tap to check off; long-press to lift one and drag it onto a time grid or
 * another day's list. Tasks and blocks dropped here lose their time.
 */
export function AnytimeList({
  tasks,
  isToday,
  onToggleDone,
  drag,
  draggingId,
  highlighted,
  removingId,
  removeProgress,
  addingId,
  addProgress,
  insertAt,
}: Props) {
  if (tasks.length === 0 && !isToday) return null;
  // Another day's only task arriving or leaving: the whole section (label too) slides open/closed.
  const only = !isToday && tasks.length === 1 ? tasks[0].id : null;
  const sectionMotion =
    only && only === removingId ? 'removing' : only && only === addingId ? 'adding' : null;
  const content = (
    <View style={{ paddingBottom: ANYTIME_BOTTOM }}>
      <SectionLabel highlighted={highlighted} />
      <View className={cn('-mx-1 rounded-[20px] px-1', highlighted && 'bg-accent/10')}>
        {insertAt !== null && tasks.length > 0 && (
          // Drawn in the gap where the task would go (over the layout, nothing moves).
          <View
            pointerEvents="none"
            className="bg-accent absolute left-3 right-3 z-10 rounded-full"
            style={{
              height: 3,
              top: insertAt * (ANYTIME_ROW_H + ANYTIME_ROW_GAP) - ANYTIME_ROW_GAP / 2 - 1.5,
            }}
          />
        )}
        {tasks.length === 0 ? (
          <HintRow highlighted={highlighted} />
        ) : (
          tasks.map((task, i) => (
            <AnytimeRow
              key={task.id}
              task={task}
              first={i === 0}
              onToggleDone={onToggleDone}
              drag={drag}
              faded={task.id === draggingId}
              // The last task leaving swaps straight to the hint row (same height): no collapse.
              motion={
                task.id === removingId && tasks.length > 1
                  ? 'removing'
                  : task.id === addingId && tasks.length > 1
                    ? 'adding'
                    : null
              }
              progress={task.id === removingId ? removeProgress : addProgress}
            />
          ))
        )}
      </View>
    </View>
  );
  if (!sectionMotion) return content;
  return (
    <SlidingSection
      motion={sectionMotion}
      progress={sectionMotion === 'removing' ? removeProgress : addProgress}
    >
      {content}
    </SlidingSection>
  );
}

/** A one-task section opening (adding) or closing (removing) as `progress` goes 0 → 1. */
function SlidingSection({
  motion,
  progress,
  children,
}: {
  motion: 'removing' | 'adding';
  progress: SharedValue<number>;
  children: ReactNode;
}) {
  const full = anytimeHeight(1); // a plain number: the style below runs on the UI thread
  const style = useAnimatedStyle(() => {
    const shown = motion === 'removing' ? 1 - progress.get() : progress.get();
    return { height: full * shown, opacity: shown };
  });
  return <Animated.View style={[{ overflow: 'hidden' }, style]}>{children}</Animated.View>;
}

function SectionLabel({ highlighted }: { highlighted: boolean }) {
  return (
    <Text
      style={{ height: ANYTIME_LABEL_H }}
      className={cn(
        'text-caption px-1 font-medium uppercase',
        highlighted ? 'text-accent' : 'text-subtle',
      )}
    >
      Anytime
    </Text>
  );
}

function HintRow({ highlighted }: { highlighted: boolean }) {
  return (
    <View
      style={{ height: ANYTIME_ROW_H }}
      className={cn(
        'items-center justify-center rounded-2xl border border-dashed',
        highlighted ? 'border-accent' : 'border-border',
      )}
    >
      <Text className={cn('text-subhead', highlighted ? 'text-accent' : 'text-subtle')}>
        Drag tasks here to do anytime
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
  /** Collapsing out (removing) or growing in (adding) as `progress` goes 0 → 1. */
  motion: 'removing' | 'adding' | null;
  progress: SharedValue<number>;
}

function AnytimeRow({
  task,
  first,
  onToggleDone,
  drag,
  faded,
  motion,
  progress,
}: RowProps) {
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

  const tap = useTapGesture({
    maxDuration: 250,
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
    if (!motion) return { height: ANYTIME_ROW_H + gap, marginBottom: 0, opacity: 1 };
    const shown = motion === 'removing' ? 1 - progress.get() : progress.get();
    return {
      height: (ANYTIME_ROW_H + gap) * shown,
      marginBottom: first ? -ANYTIME_ROW_GAP * (1 - shown) : 0,
      opacity: shown,
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
