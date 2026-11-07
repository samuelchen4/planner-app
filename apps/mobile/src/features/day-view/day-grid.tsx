import { Card } from '@planner/ui';
import { useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';

import { useCanvasScroll } from './canvas-scroll';
import { contentBounds, edgeRange, type Edge } from './day-entries';
import { EDGE_HANDLE_H, EdgeHandle, useEdgeDrag } from './edge-handle';
import { formatEdge } from './time';
import { Timeline } from './timeline';
import {
  GRID_PAD_Y,
  gridHeight,
  PX_PER_MIN,
  type TimelineEntry,
  type TimeWindow,
} from './timeline-constants';

/** Height of a grid card: a handle strip above and below the grid. */
export const dayGridHeight = (w: TimeWindow) => EDGE_HANDLE_H * 2 + gridHeight(w);

interface Props {
  window: TimeWindow;
  entries: TimelineEntry[];
  isToday: boolean;
  onMove: (id: string, startMin: number) => void;
  onToggleDone: (id: string) => void;
  onDragChange: (dragging: boolean) => void;
  /** An edge was dragged and released: set it to `minutes`. */
  onEdgeCommit: (edge: Edge, minutes: number) => void;
}

/**
 * A day's grid card with stretchable edges.
 *
 * The Timeline inside is always the whole day (absolute time-of-day positions); this card just
 * shows a slice of it: a clipping viewport sized to the window, with the day offset so the
 * window's start sits at the top. Window edges live in shared values, so the slice can change on
 * the UI thread without anything inside the day moving.
 *
 * While an edge is dragged its `delta` grows/shrinks the slice frame by frame:
 * - bottom edge: the card gets taller/shorter, pushing later days along;
 * - top edge: the card grows at its top too, and the canvas scrolls by the same amount every
 *   frame, so the grid stays still and everything above it moves with the finger.
 * On release the edge springs to the nearest hour, then the new edge and a zero delta are applied
 * together (one UI-thread step, no visible change) and React is told afterwards.
 */
export function DayGrid({
  window,
  entries,
  isToday,
  onMove,
  onToggleDone,
  onDragChange,
  onEdgeCommit,
}: Props) {
  const { listRef, scrollY } = useCanvasScroll();
  const bounds = useMemo(() => contentBounds(entries), [entries]);
  const [activeEdge, setActiveEdge] = useState<Edge | null>(null);
  const [preview, setPreview] = useState<{ edge: Edge; minutes: number } | null>(null);

  // The window on the UI thread. Drags write their result here directly; React state follows.
  const startValue = useSharedValue(window.startMin);
  const endValue = useSharedValue(window.endMin);
  const { startMin, endMin } = window;
  useLayoutEffect(() => {
    // Only differs when the window changed some other way (data, settings); after a drag it
    // already matches.
    if (startValue.get() !== startMin) startValue.set(startMin);
    if (endValue.get() !== endMin) endValue.set(endMin);
  }, [startMin, endMin, startValue, endValue]);

  const callbacks = (edge: Edge) => ({
    onActiveChange: (on: boolean) => {
      if (on) haptics.lift();
      setActiveEdge(on ? edge : null);
      onDragChange(on);
    },
    onPreview: (minutes: number) => {
      haptics.tick();
      setPreview({ edge, minutes });
    },
    onLimit: () => haptics.limit(),
    onCommit: (minutes: number) => {
      setPreview(null);
      onEdgeCommit(edge, minutes);
    },
  });

  const top = useEdgeDrag({
    edge: 'top',
    edgeValue: startValue,
    range: edgeRange('top', window, bounds),
    ...callbacks('top'),
  });
  const bottom = useEdgeDrag({
    edge: 'bottom',
    edgeValue: endValue,
    range: edgeRange('bottom', window, bounds),
    ...callbacks('bottom'),
  });

  // Top edge: scroll the canvas in lockstep with the drag so the grid itself never moves.
  const scrollAnchor = useSharedValue(0);
  useAnimatedReaction(
    () => top.following.get(),
    (on, was) => {
      if (on && !was) scrollAnchor.set(scrollY.get());
    },
  );
  useAnimatedReaction(
    () => top.delta.get(),
    (d) => {
      if (top.following.get()) scrollTo(listRef, 0, scrollAnchor.get() + d, false);
    },
  );

  const viewportStyle = useAnimatedStyle(() => ({
    height:
      GRID_PAD_Y * 2 +
      (endValue.get() - startValue.get()) * PX_PER_MIN +
      top.delta.get() +
      bottom.delta.get(),
  }));
  // Shift the whole day up so the window's start lands just below the top padding.
  const dayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: GRID_PAD_Y - startValue.get() * PX_PER_MIN + top.delta.get() }],
  }));

  // Labels: while dragging, where the edge will land; otherwise a hint of the next hour beyond it.
  const label = (edge: Edge) => {
    if (preview?.edge === edge) return formatEdge(preview.minutes);
    const [lo, hi] = edgeRange(edge, window, bounds);
    if (edge === 'top') {
      return startMin > lo ? formatEdge(Math.max(lo, (Math.ceil(startMin / 60) - 1) * 60)) : null;
    }
    return endMin < hi ? formatEdge(Math.min(hi, (Math.floor(endMin / 60) + 1) * 60)) : null;
  };

  return (
    <Card className="py-0 pl-1 pr-2">
      <EdgeHandle
        gesture={top.gesture}
        edge="top"
        label={label('top')}
        highlighted={activeEdge === 'top'}
      />
      <Animated.View style={[styles.viewport, viewportStyle]}>
        <Animated.View style={dayStyle}>
          <Timeline
            entries={entries}
            window={window}
            onMove={onMove}
            onToggleDone={onToggleDone}
            onDragChange={onDragChange}
            showNow={isToday}
          />
        </Animated.View>
      </Animated.View>
      <EdgeHandle
        gesture={bottom.gesture}
        edge="bottom"
        label={label('bottom')}
        highlighted={activeEdge === 'bottom'}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
});
