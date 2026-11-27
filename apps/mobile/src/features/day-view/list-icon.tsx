import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { useColors } from '@/lib/theme';

/** The subtle mark next to a task's title when the task is a list (it has entries of its own). */
export function ListIcon() {
  const colors = useColors();
  return (
    <View className="ml-1.5" accessibilityLabel="List">
      <SymbolView name="list.bullet" size={12} weight="semibold" tintColor={colors.muted} />
    </View>
  );
}

/** The subtle mark next to a task's title when it has notes. */
export function NoteIcon() {
  const colors = useColors();
  return (
    <View className="ml-1.5" accessibilityLabel="Has notes">
      <SymbolView name="note.text" size={12} weight="semibold" tintColor={colors.muted} />
    </View>
  );
}

/** The subtle mark next to a recurring task's title (a circular arrow). */
export function RepeatIcon() {
  const colors = useColors();
  return (
    <View className="ml-1.5" accessibilityLabel="Repeats">
      <SymbolView name="repeat" size={11} weight="semibold" tintColor={colors.muted} />
    </View>
  );
}

/** The subtle mark next to a calendar event's title (it's mirrored from another calendar). */
export function CalendarIcon() {
  const colors = useColors();
  return (
    <View className="ml-1.5" accessibilityLabel="Calendar event">
      <SymbolView name="calendar" size={11} weight="semibold" tintColor={colors.muted} />
    </View>
  );
}
