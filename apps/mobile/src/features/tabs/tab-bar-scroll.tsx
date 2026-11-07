import { createContext, use, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/** 1 while the tab bar is shrunk (user scrolling down), 0 at normal size. */
const CompactContext = createContext<SharedValue<number> | null>(null);

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const compact = useSharedValue(0);
  return <CompactContext value={compact}>{children}</CompactContext>;
}

export function useTabBarCompact(): SharedValue<number> {
  const value = use(CompactContext);
  if (!value) throw new Error('useTabBarCompact must be used inside <TabBarScrollProvider>');
  return value;
}

// Ignore jitter: the direction only counts after this much travel.
const THRESHOLD = 8;

/**
 * Hooks a screen's scrolling up to the tab bar: scrolling down shrinks it, scrolling up (or
 * reaching the top) restores it. Only the user's own scrolling counts (a drag, or the fling after
 * it), so programmatic jumps like "scroll to now" don't shrink it. All handlers are worklets, so
 * they can be called from a Reanimated scroll handler or straight from JS scroll events.
 */
export function useTabBarScrollTracker() {
  const compact = useTabBarCompact();
  const last = useSharedValue(0);
  const userScrolling = useSharedValue(false);

  return {
    onBegin: (y: number) => {
      'worklet';
      userScrolling.set(true);
      last.set(y);
    },
    onEnd: () => {
      'worklet';
      userScrolling.set(false);
    },
    onScroll: (y: number) => {
      'worklet';
      if (!userScrolling.get()) return;
      if (y <= 0) {
        compact.set(0);
        last.set(y);
        return;
      }
      const dy = y - last.get();
      if (dy > THRESHOLD) {
        compact.set(1);
        last.set(y);
      } else if (dy < -THRESHOLD) {
        compact.set(0);
        last.set(y);
      }
    },
  };
}
