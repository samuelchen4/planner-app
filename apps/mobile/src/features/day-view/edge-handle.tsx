import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture, type PanGesture } from 'react-native-gesture-handler';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useColors } from '@/lib/theme';

import type { Edge } from './day-entries';
import { GUTTER_WIDTH, PX_PER_MIN } from './timeline-constants';

/** Height of the handle strip above/below a grid. */
export const EDGE_HANDLE_H = 28;
const LONG_PRESS_MS = 250;
const SNAP_SPRING = { damping: 24, stiffness: 260, mass: 0.7 };

interface EdgeDragOptions {
  edge: Edge;
  /** The edge's committed position (minutes). */
  edgeMin: number;
  /** Where the edge may go, [min, max] minutes (see edgeRange). */
  range: [number, number];
  onActiveChange: (active: boolean) => void;
  /** The whole hour the edge would snap to changed (for the label + a haptic tick). */
  onPreview: (minutes: number) => void;
  /** The drag ran into the range limit. */
  onLimit: () => void;
  /** Released and settled on `minutes`: commit it. */
  onCommit: (minutes: number) => void;
}

/**
 * Long-press-and-drag on an edge handle. The edge follows the finger smoothly (on the UI thread,
 * via `delta`); on release it springs to the nearest whole hour, then `onCommit` makes it real.
 * `delta` is in points, positive = outward (grid grows), negative = inward (grid shrinks).
 */
export function useEdgeDrag({
  edge,
  edgeMin,
  range: [lo, hi],
  onActiveChange,
  onPreview,
  onLimit,
  onCommit,
}: EdgeDragOptions) {
  const delta = useSharedValue(0);
  const active = useSharedValue(false);
  // True from the moment the drag starts until the release spring settles (anything that mirrors
  // `delta`, like the canvas scroll, follows it during this time).
  const following = useSharedValue(false);
  const startY = useSharedValue(0);
  const snapped = useSharedValue(edgeMin);
  const clamped = useSharedValue(false);
  const top = edge === 'top';

  const gesture = usePanGesture({
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (e) => {
      'worklet';
      // absoluteY (window coordinates), not translation: the handle itself moves during the drag.
      startY.set(e.absoluteY);
      snapped.set(edgeMin);
      clamped.set(false);
      following.set(true);
      active.set(true);
      scheduleOnRN(onActiveChange, true);
    },
    onUpdate: (e) => {
      'worklet';
      const moved = (e.absoluteY - startY.get()) / PX_PER_MIN; // minutes, + = down
      const raw = edgeMin + moved;
      const m = Math.min(hi, Math.max(lo, raw));
      delta.set((top ? edgeMin - m : m - edgeMin) * PX_PER_MIN);

      const isClamped = m !== raw;
      if (isClamped && !clamped.get()) scheduleOnRN(onLimit);
      clamped.set(isClamped);

      const s = Math.min(hi, Math.max(lo, Math.round(m / 60) * 60));
      if (s !== snapped.get()) {
        snapped.set(s);
        scheduleOnRN(onPreview, s);
      }
    },
    onDeactivate: () => {
      'worklet';
      const s = snapped.get();
      const target = (top ? edgeMin - s : s - edgeMin) * PX_PER_MIN;
      delta.set(
        withSpring(target, SNAP_SPRING, () => {
          'worklet';
          following.set(false);
          scheduleOnRN(onCommit, s);
        }),
      );
    },
    onFinalize: () => {
      'worklet';
      if (!active.get()) return;
      active.set(false);
      scheduleOnRN(onActiveChange, false);
    },
  });

  return { gesture, delta, active, following };
}

interface HandleProps {
  edge: Edge;
  /** Small time label in the gutter; null hides it. */
  label: string | null;
  highlighted: boolean;
}

/** The handle's look: a small faded time, a faint line and a chevron pointing outward. */
function EdgeHandleVisual({ edge, label, highlighted }: HandleProps) {
  const colors = useColors();
  const tint = highlighted ? colors.accent : colors.subtle;
  return (
    <View style={[styles.strip, { opacity: highlighted ? 1 : 0.55 }]}>
      <Text numberOfLines={1} className="text-caption2" style={[styles.label, { color: tint }]}>
        {label ?? ''}
      </Text>
      <View style={[styles.line, { backgroundColor: tint }]} />
      <View style={styles.chevron}>
        <SymbolView
          name={edge === 'top' ? 'chevron.compact.up' : 'chevron.compact.down'}
          size={16}
          tintColor={tint}
        />
      </View>
    </View>
  );
}

/** The touchable handle strip (the gesture lives here; visuals are EdgeHandleVisual). */
export function EdgeHandle({ gesture, ...visual }: HandleProps & { gesture: PanGesture }) {
  return (
    <GestureDetector gesture={gesture}>
      <View>
        <EdgeHandleVisual {...visual} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  strip: { height: EDGE_HANDLE_H, flexDirection: 'row', alignItems: 'center' },
  label: {
    width: GUTTER_WIDTH - 6,
    marginRight: 6,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.6 },
  chevron: { position: 'absolute', left: GUTTER_WIDTH, right: 0, alignItems: 'center' },
});
