import { priorityColors, type PriorityLevel } from '@planner/ui';
import type { ViewStyle } from 'react-native';

import { useScheme } from './theme';

/** Border width of a prioritised task on the day view. */
export const PRIORITY_BORDER_WIDTH = 2;

const isLevel = (p: number | null | undefined): p is PriorityLevel => p === 1 || p === 2 || p === 3;

/** A priority level's colour (darker per level) in the current scheme; null for none. */
export function usePriorityColor(priority: number | null | undefined): string | null {
  const scheme = useScheme();
  return isLevel(priority) ? priorityColors[scheme][priority] : null;
}

/** The border a prioritised block or row gets on the day view (none: no style). */
export function usePriorityBorder(priority: number | null | undefined): ViewStyle | undefined {
  const color = usePriorityColor(priority);
  return color ? { borderWidth: PRIORITY_BORDER_WIDTH, borderColor: color } : undefined;
}

/** Dark or white text, whichever reads better on `hex` (the lighter levels need dark text). */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1E1446' : '#FFFFFF';
}

/** '!', '!!', '!!!' (none shows a single, unhighlighted '!'). */
export const priorityMarks = (priority: number) => '!'.repeat(Math.max(1, priority));
