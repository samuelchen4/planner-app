import { createContext, use } from 'react';
import type { FlatList } from 'react-native';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';

/**
 * The day canvas's scroll view, exposed to the grids inside it so they can scroll it from the UI
 * thread (e.g. keeping the grid still while its top edge is dragged).
 */
export interface CanvasScroll {
  listRef: AnimatedRef<FlatList<Date>>;
  /** Current vertical scroll offset, kept up to date on the UI thread. */
  scrollY: SharedValue<number>;
}

export const CanvasScrollContext = createContext<CanvasScroll | null>(null);

export function useCanvasScroll(): CanvasScroll {
  const value = use(CanvasScrollContext);
  if (!value) throw new Error('useCanvasScroll must be used inside the DayCanvas');
  return value;
}
