import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Thin wrapper so callers don't need to think about web (no haptics there).
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  /** Picking something up (drag start). */
  lift: () => enabled && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Crossing a detent, e.g. snapping to the next time slot. */
  tick: () => enabled && void Haptics.selectionAsync(),
  /** Checking an item off. */
  check: () => enabled && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Hitting a hard limit (e.g. the 12:01 AM / 11:59 PM bound). */
  limit: () => enabled && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};
