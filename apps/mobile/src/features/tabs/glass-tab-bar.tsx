import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createTask, type NewTaskKind } from '@/db/tasks';
import { haptics } from '@/lib/haptics';
import { openItem } from '@/lib/open-item';
import { TABS } from '@/lib/tabs';
import { useColors } from '@/lib/theme';

import { useTabBarCompact } from './tab-bar-scroll';

const BAR_HEIGHT = 59;
const BAR_PAD = 4;
const SIDE_MARGIN = 24;
/** How much the bubble stretches halfway between two tabs (1 = none). */
const STRETCH = 1.28;
/** The bar's size while the user is scrolling down. */
const COMPACT_SCALE = 0.9;
const RESIZE_SPRING = { damping: 20, stiffness: 260, mass: 0.6 };
/** The add button sits in this slot (between Habits and Lists); tabs after it shift right. */
const ADD_SLOT = 2;
const ADD_SIZE = 46;
/** What the add button makes on each page. */
const ADD_KIND: Record<string, NewTaskKind> = { index: 'task', habits: 'habit', lists: 'list' };
const slotOf = (tab: number) => (tab < ADD_SLOT ? tab : tab + 1);

/** Distance from the bar's bottom edge to the bottom of the screen. */
const barBottom = (safeBottom: number) => Math.max(safeBottom - 4, 16);

/** Space content should leave at the bottom so the floating bar doesn't cover it. */
export function useTabBarSpace() {
  const { bottom } = useSafeAreaInsets();
  return barBottom(bottom) + BAR_HEIGHT + 12;
}

/**
 * Floating glass tab bar for the swipeable tab pager. The selection bubble follows the pager's
 * live `position`: as you drag between screens it stretches away from the current tab and slides
 * over to the next, and the icons cross-fade to the accent colour as it passes them. In the middle,
 * a round add button (not a tab: the bubble slides past it) makes a new item for the current page
 * (a task for today, a habit, a list) and opens its details sheet to name it.
 */
export function GlassTabBar({ state, position, navigateToTab }: MaterialTopTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [rowWidth, setRowWidth] = useState(0);
  const count = state.routes.length;
  // onLayout width includes the row's padding; the add button takes a slot too.
  const itemWidth = (rowWidth - BAR_PAD * 2) / (count + 1);
  const addKind = ADD_KIND[state.routes[state.index]?.name] ?? 'task';
  const add = () => {
    haptics.lift();
    openItem(createTask(addKind, new Date()), { isNew: true });
  };

  // Shrinks while scrolling down (see useTabBarScrollTracker), anchored at its bottom edge.
  const compact = useTabBarCompact();
  const resizeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(compact.get() ? COMPACT_SCALE : 1, RESIZE_SPRING) }],
  }));

  // A tick whenever the selected tab changes, whether by swipe or tap; a new screen starts with
  // the bar at full size.
  const lastIndex = useRef(state.index);
  useEffect(() => {
    if (lastIndex.current !== state.index) {
      haptics.tick();
      compact.set(0);
    }
    lastIndex.current = state.index;
  }, [state.index, compact]);

  const indices = state.routes.map((_, i) => i);
  // Between tabs (x.5) the bubble is stretched wide and slightly squashed; on a tab it's at rest.
  const halfway = indices.flatMap((i) => (i < count - 1 ? [i, i + 0.5] : [i]));
  const bubbleStyle = {
    width: itemWidth,
    transform: [
      {
        translateX: position.interpolate({
          inputRange: indices,
          outputRange: indices.map((i) => slotOf(i) * itemWidth),
          extrapolate: 'clamp' as const,
        }),
      },
      {
        scaleX: position.interpolate({
          inputRange: halfway,
          outputRange: halfway.map((p) => (p % 1 === 0 ? 1 : STRETCH)),
          extrapolate: 'clamp' as const,
        }),
      },
      {
        scaleY: position.interpolate({
          inputRange: halfway,
          outputRange: halfway.map((p) => (p % 1 === 0 ? 1 : 0.9)),
          extrapolate: 'clamp' as const,
        }),
      },
    ],
  };

  const glass = isLiquidGlassAvailable();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: barBottom(insets.bottom) }]}>
      {/* Shadow on the outer view: the inner one clips to the capsule shape, which would cut it off. */}
      <Reanimated.View style={[styles.shadow, resizeStyle]}>
        <View style={styles.capsule}>
          {glass ? (
            <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
          ) : (
            <BlurView tint="systemChromeMaterial" intensity={90} style={StyleSheet.absoluteFill} />
          )}

          <View style={styles.row} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
            {rowWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[styles.bubble, { backgroundColor: colors.accent }, bubbleStyle]}
              />
            )}

            {state.routes.map((route, i) => {
              const tab = TABS.find((t) => t.name === route.name);
              if (!tab) return null;
              const addButton = i === ADD_SLOT && (
                <Pressable
                  key="add"
                  onPress={add}
                  accessibilityRole="button"
                  accessibilityLabel={`New ${addKind}`}
                  style={styles.item}
                  className="items-center justify-center active:opacity-70"
                >
                  <View style={[styles.add, { backgroundColor: colors.accent }]}>
                    <SymbolView
                      name="plus"
                      size={22}
                      weight="semibold"
                      tintColor={colors['on-accent']}
                    />
                  </View>
                </Pressable>
              );
              const focused = state.index === i;
              const activeOpacity = position.interpolate({
                inputRange: [i - 1, i, i + 1],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp',
              });
              return [
                addButton,
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={tab.label}
                  onPress={() => {
                    if (!focused) navigateToTab(route.key);
                  }}
                  style={styles.item}
                >
                  <TabItem icon={tab.sf.default} label={tab.label} color={colors.muted} />
                  <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
                    <TabItem icon={tab.sf.selected} label={tab.label} color={colors.accent} />
                  </Animated.View>
                </Pressable>,
              ];
            })}
          </View>
        </View>
      </Reanimated.View>
    </View>
  );
}

function TabItem({ icon, label, color }: { icon: SFSymbol; label: string; color: string }) {
  return (
    <View style={styles.itemInner}>
      <SymbolView name={icon} size={22} tintColor={color} />
      <Text className="text-caption2 font-medium" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: SIDE_MARGIN, right: SIDE_MARGIN },
  shadow: {
    transformOrigin: 'bottom', // shrink toward the bottom edge, so it doesn't float upward
    borderRadius: BAR_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  capsule: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row', padding: BAR_PAD },
  bubble: {
    position: 'absolute',
    top: BAR_PAD,
    bottom: BAR_PAD,
    left: BAR_PAD,
    borderRadius: (BAR_HEIGHT - BAR_PAD * 2) / 2,
    opacity: 0.14,
  },
  item: { flex: 1 },
  add: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
