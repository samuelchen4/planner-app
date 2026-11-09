import type { Task, TaskColor } from '@/db/schema';
import { noteColors } from '@planner/ui';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useColors, useScheme } from '@/lib/theme';

/** Icons a habit can pick (SF Symbols). */
export const HABIT_ICONS: SFSymbol[] = [
  'drop.fill',
  'book.fill',
  'figure.walk',
  'figure.run',
  'figure.flexibility',
  'dumbbell.fill',
  'bed.double.fill',
  'moon.fill',
  'sun.max.fill',
  'leaf.fill',
  'heart.fill',
  'brain.head.profile',
  'pills.fill',
  'fork.knife',
  'cup.and.saucer.fill',
  'iphone.slash',
  'pencil',
  'music.note',
  'sparkles',
  'star.fill',
];

/** The icon grid's rows (5 across). */
const ICON_ROWS = Array.from({ length: Math.ceil(HABIT_ICONS.length / 5) }, (_, i) =>
  HABIT_ICONS.slice(i * 5, i * 5 + 5),
);

/** Colours a habit can pick: the sticky-note palette (no green, it's reserved for done). */
export const HABIT_COLORS: TaskColor[] = ['yellow', 'orange', 'pink', 'lavender', 'blue'];

const DEFAULT_ICON: SFSymbol = 'star.fill';
const DEFAULT_COLOR: TaskColor = 'blue';

/** A habit's colours (paper fill, edge for border and accents), defaults filled in. */
export function useHabitLook(habit: Task) {
  const scheme = useScheme();
  const color = habit.color ?? DEFAULT_COLOR;
  return {
    color,
    icon: (habit.icon as SFSymbol | undefined) ?? DEFAULT_ICON,
    ...noteColors[scheme][color],
  };
}

/** The habit's logo: its icon in white on a rounded square of its colour. */
export function HabitBadge({ habit, size = 34 }: { habit: Task; size?: number }) {
  const colors = useColors();
  const { icon, edge } = useHabitLook(habit);
  return (
    <View
      accessible
      accessibilityLabel={`Icon: ${icon}`}
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: edge }}
    >
      <SymbolView name={icon} size={size * 0.5} tintColor={colors['on-accent']} />
    </View>
  );
}

/**
 * Pick a habit's colour and icon (in its details sheet). Changes apply instantly.
 */
export function HabitLookPicker({
  habit,
  onChange,
}: {
  habit: Task;
  onChange: (patch: Partial<Pick<Task, 'color' | 'icon'>>) => void;
}) {
  const colors = useColors();
  const scheme = useScheme();
  const look = useHabitLook(habit);
  const pick = (patch: Partial<Pick<Task, 'color' | 'icon'>>) => {
    haptics.tick();
    onChange(patch);
  };

  return (
    <View className="bg-card rounded-card gap-4 p-4">
      <Text className="text-footnote text-muted font-semibold uppercase">Colour</Text>
      <View className="flex-row justify-between">
        {HABIT_COLORS.map((c) => {
          const selected = c === look.color;
          return (
            <Pressable
              key={c}
              onPress={() => pick({ color: c })}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={c}
              accessibilityState={{ selected }}
              className="items-center justify-center rounded-full"
              // A ring around the selected swatch.
              style={{
                width: 44,
                height: 44,
                borderWidth: 2.5,
                borderColor: selected ? noteColors[scheme][c].edge : 'transparent',
              }}
            >
              <View
                className="rounded-full"
                style={{ width: 32, height: 32, backgroundColor: noteColors[scheme][c].edge }}
              />
            </Pressable>
          );
        })}
      </View>

      <Text className="text-footnote text-muted font-semibold uppercase">Icon</Text>
      <View className="gap-2.5">
        {ICON_ROWS.map((row) => (
          <View key={row[0]} className="flex-row justify-between">
            {row.map((name) => {
              const selected = name === look.icon;
              return (
                <Pressable
                  key={name}
                  onPress={() => pick({ icon: name })}
                  accessibilityRole="radio"
                  accessibilityLabel={name}
                  accessibilityState={{ selected }}
                  className="items-center justify-center rounded-xl"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: selected ? look.edge : look.paper,
                  }}
                >
                  <SymbolView
                    name={name}
                    size={22}
                    tintColor={selected ? colors['on-accent'] : look.edge}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
