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
