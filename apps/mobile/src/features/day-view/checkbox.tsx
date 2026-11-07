import { cn } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/lib/theme';

interface Props {
  done: boolean;
  /** Diameter in points. */
  size?: number;
}

/**
 * The round check used by planner items: a hollow accent ring when open (the card shows through, a
 * hole in the tinted block), a filled `done` circle
 * with a checkmark when checked off. Pops briefly when it changes. Purely visual: the caller owns
 * the touch target (keep it ~44pt even when this is drawn small).
 */
export function Checkbox({ done, size = 20 }: Props) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the pop on mount; only animate real changes.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.set(withSequence(withTiming(0.8, { duration: 70 }), withSpring(1, POP)));
  }, [done, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={style}>
      <View
        className={cn(
          'items-center justify-center rounded-full',
          done ? 'bg-done' : 'border-accent bg-card',
        )}
        style={{ width: size, height: size, borderWidth: done ? 0 : Math.max(1.5, size / 12) }}
      >
        {done && (
          <SymbolView
            name="checkmark"
            size={size * 0.55}
            weight="bold"
            tintColor={colors['on-accent']}
          />
        )}
      </View>
    </Animated.View>
  );
}

const POP = { damping: 12, stiffness: 400, mass: 0.5 };
