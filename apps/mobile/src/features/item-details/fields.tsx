import { cn } from '@planner/ui';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { parseDateKey, relativeDayName } from '@/features/day-view/time';
import { useColors } from '@/lib/theme';

// Pieces shared by the details sheet's views (planner items and calendar events).

/** 'Today, Nov 8' / 'Tue, Nov 10' / 'None'. */
export function dayLabel(key: string | null | undefined): string {
  if (!key) return 'None';
  const day = parseDateKey(key);
  const name = relativeDayName(day);
  return name.includes(',')
    ? name
    : `${name}, ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** One row of the body card: icon, label, value; tap to open its picker, ⓧ to clear. */
export function FieldRow({
  icon,
  label,
  value,
  active,
  onPress,
  onClear,
}: {
  icon: SFSymbol;
  label: string;
  value: string;
  active?: boolean;
  onPress?: () => void;
  onClear?: () => void;
}) {
  const colors = useColors();
  return (
    <View className="min-h-12 flex-row items-center pr-4">
      <Pressable
        onPress={() => {
          // The picker modal opens over the sheet; don't leave the keyboard covering it.
          Keyboard.dismiss();
          onPress?.();
        }}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        className="min-h-12 flex-1 flex-row items-center gap-3 pl-4 active:opacity-60"
      >
        <SymbolView name={icon} size={18} tintColor={colors.accent} />
        <Text className="text-body text-ink flex-1">{label}</Text>
        <Text
          className={cn('text-body', active ? 'text-accent' : 'text-muted')}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
      </Pressable>
      {onClear && (
        // A sibling, not inside the row's button (a nested button is invalid on web).
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label.toLowerCase()}`}
          className="ml-2 active:opacity-60"
        >
          <SymbolView name="xmark.circle.fill" size={17} tintColor={colors.subtle} />
        </Pressable>
      )}
    </View>
  );
}

export function Separator() {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 46,
      }}
    />
  );
}
