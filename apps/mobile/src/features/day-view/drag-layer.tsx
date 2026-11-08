import { useMemo } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Shared state for dragging a task across the Today screen: an Anytime row or a planner block,
 * onto any day's grid or into the Anytime list. The floating copy is drawn by the screen above
 * everything (header included); the canvas drives it and works out where it would land.
 * Positions are in the screen's own coordinates (its top-left is 0,0).
 */
export interface DragLayer {
  /** Top-left of the floating copy. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** The finger (drives auto-scroll and the drop target). */
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  /** Where the finger lifted the task (auto-scroll waits until it has moved away). */
  liftY: SharedValue<number>;
  /** Where on the copy the finger holds it, so it doesn't jump under the finger. */
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  /** The screen's position in the window (gesture events are in window coordinates). */
  rootX: SharedValue<number>;
  rootY: SharedValue<number>;
  /** The floating copy fades out while it's shown as a preview block on a grid instead. */
  opacity: SharedValue<number>;
}

export function useDragLayer(): DragLayer {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const liftY = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const opacity = useSharedValue(1);
  return useMemo(
    () => ({ x, y, fingerX, fingerY, liftY, grabX, grabY, rootX, rootY, opacity }),
    [x, y, fingerX, fingerY, liftY, grabX, grabY, rootX, rootY, opacity],
  );
}

/** What was picked up. Blocks say where the finger holds them, so drops keep that point. */
export type DragSource =
  | { kind: 'anytime'; id: string }
  | {
      kind: 'block';
      id: string;
      /** Minutes from the block's top to the finger. */
      anchorMin: number;
      /** The block's left edge and size on screen (for its floating copy). */
      x: number;
      width: number;
      height: number;
    };

/** Passed down to every draggable row/block. Callbacks are JS-thread functions. */
export interface TaskDragHandlers {
  layer: DragLayer;
  onStart: (source: DragSource) => void;
  /** The finger moved (y in screen coordinates). */
  onMove: (fingerY: number) => void;
  onEnd: (canceled: boolean) => void;
}

type PointerEvent = { absoluteX: number; absoluteY: number; x: number; y: number };

/** Gesture start: put the floating copy exactly over the lifted view, under the finger. */
export function liftAt(layer: DragLayer, e: PointerEvent) {
  'worklet';
  const fx = e.absoluteX - layer.rootX.get();
  const fy = e.absoluteY - layer.rootY.get();
  layer.grabX.set(e.x);
  layer.grabY.set(e.y);
  layer.x.set(fx - e.x);
  layer.y.set(fy - e.y);
  layer.fingerX.set(fx);
  layer.fingerY.set(fy);
  layer.liftY.set(fy);
  layer.opacity.set(1);
}

/** Gesture update: the copy follows the finger. Returns the finger's screen y. */
export function follow(layer: DragLayer, e: { absoluteX: number; absoluteY: number }) {
  'worklet';
  const fx = e.absoluteX - layer.rootX.get();
  const fy = e.absoluteY - layer.rootY.get();
  layer.x.set(fx - layer.grabX.get());
  layer.y.set(fy - layer.grabY.get());
  layer.fingerX.set(fx);
  layer.fingerY.set(fy);
  return fy;
}
