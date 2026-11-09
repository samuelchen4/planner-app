import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DRAW_MS = 360;
const UNDRAW_MS = 160;

/**
 * 0 → 1 as a ring is drawn. Animates when `on` changes (drawing on, quickly un-drawing off); starts
 * at its end state on mount, so existing marks don't animate in.
 */
export function useDrawProgress(on: boolean): SharedValue<number> {
  const progress = useSharedValue(on ? 1 : 0);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    progress.set(
      withTiming(on ? 1 : 0, {
        duration: on ? DRAW_MS : UNDRAW_MS,
        easing: on ? Easing.inOut(Easing.cubic) : Easing.out(Easing.quad),
      }),
    );
  }, [on, progress]);
  return progress;
}

/**
 * A circle stroked like a pen drawing it: it starts at the top and sweeps clockwise as `progress`
 * goes 0 → 1. Fills its parent's top-left `size` square (absolute) and ignores touches.
 */
export function DrawnRing({
  progress,
  size,
  strokeWidth,
  color,
}: {
  progress: SharedValue<number>;
  size: number;
  strokeWidth: number;
  color: string;
}) {
  const r = (size - strokeWidth) / 2;
  const length = 2 * Math.PI * r;
  const props = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.get()),
  }));
  return (
    <Svg
      width={size}
      height={size}
      pointerEvents="none"
      // Start at 12 o'clock (SVG circles start at 3).
      style={{ position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] }}
    >
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={props}
      />
    </Svg>
  );
}
