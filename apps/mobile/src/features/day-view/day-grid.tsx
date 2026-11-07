import { Card } from '@planner/ui';
import { useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { formatEdge, MINUTES_PER_DAY } from './time';
import { HourRow, Timeline } from './timeline';
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
  onDragChange: (dragging: boolean) => void;
  /** An edge was dragged and released: set it to `minutes`. */
  onEdgeCommit: (edge: Edge, minutes: number) => void;
}

/**
 * A day's grid card with stretchable edges. While an edge is dragged, everything runs on the UI
 * thread: the grid's viewport grows/shrinks by the drag (`delta`), with the grid content shifted
 * down by the top edge's delta so earlier hours appear above it.
 * - Bottom edge: the card simply gets taller/shorter, pushing later days along.
 * - Top edge: the card also grows at its top, and the canvas scrolls by the same amount every
 *   frame, so the grid stays still and everything above it (handle, label, earlier days) is
 *   pushed up — or pulled down when shrinking.
 * On release the edge springs to the nearest hour and the parent commits it as the new window;
 * by then the layout already matches, so nothing jumps.
 */
export function DayGrid({ window, entries, isToday, onMove, onDragChange, onEdgeCommit }: Props) {
  const { listRef, scrollY } = useCanvasScroll();
  const bounds = useMemo(() => contentBounds(entries), [entries]);
  const [activeEdge, setActiveEdge] = useState<Edge | null>(null);
  const [preview, setPreview] = useState<{ edge: Edge; minutes: number } | null>(null);
  const baseHeight = useSharedValue(gridHeight(window));

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
    edgeMin: window.startMin,
    range: edgeRange('top', window, bounds),
    ...callbacks('top'),
  });
  const bottom = useEdgeDrag({
    edge: 'bottom',
    edgeMin: window.endMin,
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

  // Once a new window is committed (and laid out), the drag offsets are folded into it. The layout
  // then matches what was on screen, so the scroll position needs no correction.
  const { startMin, endMin } = window;
  useLayoutEffect(() => {
    baseHeight.set(gridHeight({ startMin, endMin }));
    top.delta.set(0);
    bottom.delta.set(0);
  }, [startMin, endMin, baseHeight, top.delta, bottom.delta]);

  const viewportStyle = useAnimatedStyle(() => ({
    height: baseHeight.get() + top.delta.get() + bottom.delta.get(),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: top.delta.get() }],
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

  // Hour lines outside the window, revealed as either edge is pulled outward.
  const outsideHours: number[] = [];
  for (let h = 1; h < 24; h++) if (h * 60 < startMin || h * 60 > endMin) outsideHours.push(h);

  return (
    <Card className="py-0 pl-1 pr-2">
      <EdgeHandle
        gesture={top.gesture}
        edge="top"
        label={label('top')}
        highlighted={activeEdge === 'top'}
      />
      <Animated.View style={[styles.viewport, viewportStyle]}>
        <Animated.View style={contentStyle}>
          <View
            pointerEvents="none"
            style={[styles.dayRuler, { top: GRID_PAD_Y - startMin * PX_PER_MIN }]}
          >
            {outsideHours.map((h) => (
              <HourRow key={h} hour={h} y={h * 60 * PX_PER_MIN} />
            ))}
          </View>
          <Timeline
            entries={entries}
            window={window}
            onMove={onMove}
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
  // A whole-day coordinate space (minute 0 at its top), positioned so it lines up with the grid.
  dayRuler: { position: 'absolute', left: 0, right: 0, height: MINUTES_PER_DAY * PX_PER_MIN },
});
