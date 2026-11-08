import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** How long a card takes to grow out of / shrink into an empty box. */
export const MORPH_MS = 280;
const EASE = Easing.out(Easing.cubic);
/** Cards start / end this much smaller than full size (scaled about their centre). */
const SCALE_FROM = 0.92;

/**
 * A card growing out of a smaller box: its height goes from `from` to `to` (pushing what's below
 * along), and the card scales up from the box's centre while fading in. Runs once, on mount.
 */
export function GrowIn({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: MORPH_MS, easing: EASE }));
  }, [p]);
  const outer = useAnimatedStyle(() => ({ height: from + (to - from) * p.get() }));
  const inner = useAnimatedStyle(() => {
    const h = from + (to - from) * p.get();
    return {
      opacity: p.get(),
      // Keep the card centred in the growing slot, so it grows from the middle out.
      transform: [{ translateY: (h - to) / 2 }, { scale: SCALE_FROM + (1 - SCALE_FROM) * p.get() }],
    };
  });
  return (
    <Animated.View style={[{ overflow: 'hidden' }, outer]}>
      <Animated.View style={inner}>{children}</Animated.View>
    </Animated.View>
  );
}

/**
 * The reverse: a card shrinking into a smaller box as `progress` goes 0 → 1 (height `from` → `to`),
 * scaling down towards its centre and fading out while `replacement` (the box it becomes) fades in.
 */
export function ShrinkOut({
  from,
  to,
  progress,
  replacement,
  children,
}: {
  from: number;
  to: number;
  progress: SharedValue<number>;
  replacement: ReactNode;
  children: ReactNode;
}) {
  const outer = useAnimatedStyle(() => ({ height: from + (to - from) * progress.get() }));
  const inner = useAnimatedStyle(() => {
    const q = progress.get();
    const h = from + (to - from) * q;
    return {
      opacity: 1 - q,
      transform: [{ translateY: (h - from) / 2 }, { scale: 1 - (1 - SCALE_FROM) * q }],
    };
  });
  const after = useAnimatedStyle(() => {
    const q = progress.get();
    const h = from + (to - from) * q;
    return { opacity: q, transform: [{ translateY: (h - to) / 2 }] };
  });
  return (
    <Animated.View style={[{ overflow: 'hidden' }, outer]}>
      <View pointerEvents="none">
        <Animated.View style={inner}>{children}</Animated.View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, after]}
      >
        {replacement}
      </Animated.View>
    </Animated.View>
  );
}

/** Pops its content in from its centre (fade + scale), once on mount. Same size: nothing moves. */
export function PopIn({ children }: { children: ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: MORPH_MS, easing: EASE }));
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ scale: SCALE_FROM + (1 - SCALE_FROM) * p.get() }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
