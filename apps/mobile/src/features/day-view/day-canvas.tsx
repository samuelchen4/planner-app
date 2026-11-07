import type { DayEntry } from '@planner/core';
import { Card } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Platform, Text, View, type FlatList as RNFlatList } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTabBarSpace } from '@/features/tabs/glass-tab-bar';
import { useTabBarScrollTracker } from '@/features/tabs/tab-bar-scroll';
import { useSettings } from '@/lib/settings';
import { useColors } from '@/lib/theme';

import { CanvasScrollContext } from './canvas-scroll';
import { PAGE_PAD_X } from './date-header';
import {
  applyStretch,
  bucketEntries,
  contentBounds,
  dayWindow,
  type AnytimeTask,
  type Edge,
  type WindowStretch,
} from './day-entries';
import { DayGrid, dayGridHeight } from './day-grid';
import type { DayRange } from './day-range';
import { EDGE_HANDLE_H } from './edge-handle';
import { minutesOfDay } from './time';
import { GRID_PAD_Y, PX_PER_MIN, type TimelineEntry, type TimeWindow } from './timeline-constants';

// Every day section has a fixed, computable height. That lets the list jump to any day instantly
// and map a scroll offset back to a day without measuring anything. Keep these in sync with the JSX.
const DAY_LABEL_H = 40;
const ANYTIME_LABEL_H = 24;
const ANYTIME_ROW_H = 48;
const ANYTIME_ROW_GAP = 8;
const ANYTIME_BOTTOM = 12;
/** A day with nothing on it (other than today) gets a short card instead of a grid. */
const EMPTY_CARD_H = 52;
const cardHeight = (w: TimeWindow | null) => (w ? dayGridHeight(w) : EMPTY_CARD_H);
const DAY_GAP = 16;
const FOOTER_H = 32;

const anytimeHeight = (n: number) =>
  n === 0 ? 0 : ANYTIME_LABEL_H + n * ANYTIME_ROW_H + (n - 1) * ANYTIME_ROW_GAP + ANYTIME_BOTTOM;

const NO_ENTRIES: TimelineEntry[] = [];
const NO_TASKS: AnytimeTask[] = [];

export interface DayCanvasHandle {
  /** Jump to a day, keeping the same time of day in view (today jumps to the current time). */
  scrollToDay: (key: string) => void;
}

interface Props {
  ref?: Ref<DayCanvasHandle>;
  range: DayRange;
  entries: DayEntry[];
  /** Height of the floating header; content is padded by it and "in view" means below it. */
  headerHeight: number;
  /** The day at the top of the visible area changed (by scrolling). */
  onVisibleDayChange: (key: string) => void;
  /** A block or grid edge started/stopped being dragged. */
  onDraggingChange?: (dragging: boolean) => void;
  onMoveItem: (id: string, startMin: number) => void;
}

/**
 * Infinite vertical canvas of days: each day's grid runs straight into the next, so scrolling past
 * midnight carries on into tomorrow (and up into yesterday). Virtualized: only the few days around
 * the viewport are rendered.
 */
export function DayCanvas({
  ref,
  range,
  entries,
  headerHeight,
  onVisibleDayChange,
  onDraggingChange,
  onMoveItem,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const tabBar = useTabBarScrollTracker();
  // Animated ref + UI-thread scroll offset, so grids can scroll the list in lockstep with a drag.
  const listRef = useAnimatedRef<RNFlatList<Date>>();
  const scrollY = useSharedValue(0);
  const canvasScroll = useMemo(() => ({ listRef, scrollY }), [listRef, scrollY]);
  const [dragging, setDragging] = useState(false);
  useEffect(() => onDraggingChange?.(dragging), [dragging, onDraggingChange]);
  const [viewportHeight, setViewportHeight] = useState(0);
  const { schedule } = useSettings();
  const { timedByDay, anytime } = useMemo(() => bucketEntries(entries), [entries]);

  // Manual edges from the stretch handles, per day. Session-only: they reset on reload.
  const [stretches, setStretches] = useState<Map<string, WindowStretch>>(() => new Map());
  // Each day's window: its natural one (see dayWindow) with any manual edges applied.
  const windows = useMemo(
    () =>
      range.keys.map((k, i) => {
        const dayEntries = timedByDay.get(k) ?? NO_ENTRIES;
        const base = dayWindow(dayEntries, schedule, i === range.todayIndex);
        return base && applyStretch(base, stretches.get(k), contentBounds(dayEntries));
      }),
    [range, timedByDay, schedule, stretches],
  );

  // Content starts under the floating header. On iOS the list already insets for the status bar
  // (contentInsetAdjustmentBehavior), so only the rest of the header needs a spacer.
  const spacer = Math.max(0, headerHeight - (Platform.OS === 'ios' ? insets.top : 0));
  const minOffset = spacer - headerHeight;

  // Where each day section starts (prefix sums); starts[i + 1] - starts[i] is day i's height.
  const starts = useMemo(() => {
    const s = [spacer];
    for (let i = 0; i < range.days.length; i++) {
      const tasks = i === range.todayIndex ? anytime.length : 0;
      s.push(s[i] + DAY_LABEL_H + anytimeHeight(tasks) + cardHeight(windows[i]) + DAY_GAP);
    }
    return s;
  }, [range, anytime.length, spacer, windows]);

  /** Content y of the top of day i's window (its first visible minute). */
  const gridTop = (i: number) =>
    starts[i] +
    DAY_LABEL_H +
    anytimeHeight(i === range.todayIndex ? anytime.length : 0) +
    EDGE_HANDLE_H +
    GRID_PAD_Y;

  /** Content y of a time of day on day i (clamped into that day's window). */
  const timeY = (i: number, minutes: number) => {
    const w = windows[i];
    if (!w) return starts[i]; // empty day: its label
    return (
      gridTop(i) + (Math.min(w.endMin, Math.max(w.startMin, minutes)) - w.startMin) * PX_PER_MIN
    );
  };

  /** Day whose section contains content position y (binary search). */
  const dayAt = (y: number) => {
    let lo = 0;
    let hi = range.days.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const offsetRef = useRef(0);
  const visibleRef = useRef(range.todayIndex);

  /** Scroll so content position y sits just under the header. */
  const showAtTop = (y: number) => {
    listRef.current?.scrollToOffset({
      offset: Math.max(minOffset, y - headerHeight),
      animated: false,
    });
  };

  const scrollToNow = () => {
    const visible = viewportHeight - headerHeight;
    const now = minutesOfDay(new Date().toISOString());
    visibleRef.current = range.todayIndex;
    showAtTop(timeY(range.todayIndex, now) - visible / 3);
  };

  useImperativeHandle(ref, () => ({
    scrollToDay: (key) => {
      const target = range.indexOf.get(key);
      if (target === undefined) return;
      if (target === range.todayIndex) return scrollToNow();
      // Keep the same time of day at the top. Days have different windows, so go via minutes.
      const current = visibleRef.current;
      const into = offsetRef.current + headerHeight - gridTop(current);
      const w = windows[current];
      const onGrid = w !== null && into >= 0 && into <= (w.endMin - w.startMin) * PX_PER_MIN;
      visibleRef.current = target;
      showAtTop(onGrid ? timeY(target, w.startMin + into / PX_PER_MIN) : starts[target]);
    },
  }));

  // Open at the current time, once the header and viewport have been measured.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || headerHeight === 0 || viewportHeight === 0) return;
    didInit.current = true;
    scrollToNow();
  });

  // A released edge drag. (The grid already scrolled the list in step with it, so committing the
  // new window needs no scroll correction.)
  const commitEdge = (day: number, edge: Edge, minutes: number) => {
    const w = windows[day];
    if (!w) return;
    const current = edge === 'top' ? w.startMin : w.endMin;
    if (minutes === current) return;
    const key = range.keys[day];
    setStretches((prev) =>
      new Map(prev).set(key, {
        ...prev.get(key),
        [edge === 'top' ? 'startMin' : 'endMin']: minutes,
      }),
    );
  };

  const handleScroll = (y: number) => {
    offsetRef.current = y;
    const day = dayAt(y + headerHeight + 1);
    if (day !== visibleRef.current) {
      visibleRef.current = day;
      onVisibleDayChange(range.keys[day]);
    }
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      tabBar.onScroll(e.contentOffset.y);
      scheduleOnRN(handleScroll, e.contentOffset.y);
    },
    // Only the user's own scrolling (drag + fling) shrinks/restores the tab bar.
    onBeginDrag: (e) => tabBar.onBegin(e.contentOffset.y),
    onEndDrag: () => tabBar.onEnd(),
    onMomentumBegin: (e) => tabBar.onBegin(e.contentOffset.y),
    onMomentumEnd: () => tabBar.onEnd(),
  });

  return (
    <CanvasScrollContext value={canvasScroll}>
      <Animated.FlatList
        ref={listRef}
        // Gesture Handler's scroll view, so long-press drags inside the list win over scrolling.
        renderScrollComponent={(props) => <GestureScrollView {...props} />}
        style={{ flex: 1 }}
        data={range.days}
        keyExtractor={(_, i) => range.keys[i]}
        extraData={windows}
        getItemLayout={(_, i) => ({
          length: starts[i + 1] - starts[i],
          offset: starts[i],
          index: i,
        })}
        initialScrollIndex={range.todayIndex}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        scrollIndicatorInsets={{ top: spacer }}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD_X }}
        ListHeaderComponent={<View style={{ height: spacer }} />}
        ListFooterComponent={<View style={{ height: FOOTER_H + tabBarSpace }} />}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <DaySection
            date={item}
            isToday={index === range.todayIndex}
            entries={timedByDay.get(range.keys[index]) ?? NO_ENTRIES}
            window={windows[index]}
            anytime={index === range.todayIndex ? anytime : NO_TASKS}
            onMove={onMoveItem}
            onDragChange={setDragging}
            onEdgeCommit={(edge, minutes) => commitEdge(index, edge, minutes)}
          />
        )}
      />
    </CanvasScrollContext>
  );
}

interface DaySectionProps {
  date: Date;
  isToday: boolean;
  entries: TimelineEntry[];
  /** null: nothing scheduled (not today), so no grid. */
  window: TimeWindow | null;
  anytime: AnytimeTask[];
  onMove: (id: string, startMin: number) => void;
  onDragChange: (dragging: boolean) => void;
  onEdgeCommit: (edge: Edge, minutes: number) => void;
}

/** One day: its label, its Anytime tasks (today only), and its grid. Heights are computed, not measured. */
function DaySection({
  date,
  isToday,
  entries,
  window,
  anytime,
  onMove,
  onDragChange,
  onEdgeCommit,
}: DaySectionProps) {
  const colors = useColors();
  const label = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View>
      <View style={{ height: DAY_LABEL_H }} className="flex-row items-end gap-2 px-1 pb-2">
        {isToday && <Text className="text-subhead text-accent font-semibold">Today</Text>}
        <Text className="text-subhead text-muted font-semibold">{label}</Text>
      </View>

      {anytime.length > 0 && (
        <View style={{ height: anytimeHeight(anytime.length) }}>
          <Text
            style={{ height: ANYTIME_LABEL_H }}
            className="text-caption text-subtle px-1 font-medium uppercase"
          >
            Anytime
          </Text>
          <View style={{ gap: ANYTIME_ROW_GAP }}>
            {anytime.map((a) => (
              <View
                key={a.id}
                style={{ height: ANYTIME_ROW_H }}
                className="bg-card flex-row items-center gap-3 rounded-2xl px-4 shadow-sm shadow-black/5"
              >
                <SymbolView name="circle" size={20} tintColor={colors.subtle} />
                <Text numberOfLines={1} className="text-body text-ink flex-1">
                  {a.title}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {window ? (
        <DayGrid
          window={window}
          entries={entries}
          isToday={isToday}
          onMove={onMove}
          onDragChange={onDragChange}
          onEdgeCommit={onEdgeCommit}
        />
      ) : (
        <Card className="justify-center py-0" style={{ height: EMPTY_CARD_H }}>
          <Text className="text-subhead text-subtle">Nothing scheduled</Text>
        </Card>
      )}
      <View style={{ height: DAY_GAP }} />
    </View>
  );
}
