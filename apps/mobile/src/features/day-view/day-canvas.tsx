import { SCHEDULE_MAX_END, type DayEntry } from '@planner/core';
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  Platform,
  Text,
  useWindowDimensions,
  View,
  type FlatList as RNFlatList,
} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTabBarSpace } from '@/features/tabs/glass-tab-bar';
import { useTabBarScrollTracker } from '@/features/tabs/tab-bar-scroll';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings';

import {
  ANYTIME_EMPTY_H,
  ANYTIME_LANE_INSET,
  ANYTIME_LANE_LEFT,
  ANYTIME_PAD,
  DropBox,
  EmptyCard,
  ANYTIME_ROW_GAP,
  ANYTIME_ROW_H,
  AnytimeList,
  anytimeHeight,
  anytimeRowTop,
} from './anytime-list';
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
import { GrowIn, MORPH_MS, ShrinkOut } from './morph';
import type { GhostTask } from './drag-ghost';
import type { DragLayer, DragSource, TaskDragHandlers } from './drag-layer';
import { EDGE_HANDLE_H } from './edge-handle';
import { minutesOfDay } from './time';
import type { DropPreview } from './timeline-block';
import {
  GRID_PAD_Y,
  PX_PER_MIN,
  SNAP_MIN,
  type TimelineEntry,
  type TimeWindow,
} from './timeline-constants';

// Every day section has a fixed, computable height. That lets the list jump to any day instantly
// and map a scroll offset back to a day without measuring anything. Keep these in sync with the JSX.
const DAY_LABEL_H = 40;
/** A day with nothing on it (other than today) gets a short card instead of a grid. */
// Same height as the empty all-day box (one all-day task).
const EMPTY_CARD_H = ANYTIME_EMPTY_H;
const cardHeight = (w: TimeWindow | null) => (w ? dayGridHeight(w) : EMPTY_CARD_H);
const DAY_GAP = 16;
const FOOTER_H = 32;

// Dragging tasks (Anytime rows and blocks) between grids and the Anytime list.
/** An Anytime task dropped on a grid becomes a block this long. */
const DROP_DURATION_MIN = 60;
/** Auto-scroll starts this close to the header's bottom / the tab bar's top... */
const AUTO_ZONE = 64;
/** ...and reaches this speed (points per ms) at the very edge. */
const AUTO_MAX_SPEED = 1.1;
/** Auto-scroll waits until the finger has moved this far from where it lifted the task. */
const ARM_DISTANCE = 12;
const BACK_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };
/** A task being dragged (an Anytime row or a planner block). */
interface ActiveDrag {
  id: string;
  title: string;
  done: boolean;
  isList: boolean;
  hasNotes: boolean;
  source: 'anytime' | 'block';
  /** The day it was picked up from. */
  sourceDay: number;
  durationMin: number;
  /** Minutes from the block's top to the finger: drops keep that point under the finger. */
  anchorMin: number;
  /** A lifted block: where it sits (to fly back to) and how it's held. */
  home: {
    day: number;
    startMin: number;
    x: number;
    grabX: number;
    width: number;
    height: number;
  } | null;
}

/**
 * Where a dragged task would land: a slot on a day's grid, a day without a grid (its "Nothing
 * scheduled" card, which creates the grid), or a position in a day's Anytime list (its label stands
 * in when it has none, and creates it).
 */
type DropTarget =
  | { kind: 'grid'; day: number; startMin: number }
  | { kind: 'newGrid'; day: number }
  | { kind: 'anytime'; day: number; index: number }
  | null;

const targetKey = (t: DropTarget) =>
  !t
    ? ''
    : t.kind === 'anytime'
      ? `a${t.day}:${t.index}`
      : t.kind === 'newGrid'
        ? `n${t.day}`
        : `${t.day}:${t.startMin}`;

const NO_ENTRIES: TimelineEntry[] = [];

/** A day's timed tasks and their times: a manual stretch lasts only while this stays the same. */
const tasksSig = (es: TimelineEntry[]) =>
  es.map((e) => `${e.id}@${e.startMin}-${e.endMin}`).join('|');
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
  onToggleDone: (id: string) => void;
  /** An Anytime task was dropped on a grid: give it this day and time. */
  onScheduleItem: (id: string, day: Date, startMin: number, durationMin: number) => void;
  /** A block was dropped on a grid: move it to this day and time (same duration). */
  onMoveItemTo: (id: string, day: Date, startMin: number) => void;
  /** A task was dropped into a day's Anytime list: no time, on that day, before `beforeId`. */
  onUnscheduleItem: (id: string, day: Date, beforeId: string | null) => void;
  /** The floating copy of a dragged task (drawn by the screen, over the header). */
  dragLayer: DragLayer;
  onDragTaskChange: (task: GhostTask | null) => void;
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
  onToggleDone,
  onScheduleItem,
  onMoveItemTo,
  onUnscheduleItem,
  dragLayer,
  onDragTaskChange,
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
  const { timedByDay, anytimeByDay } = useMemo(
    () => bucketEntries(entries, range.todayKey),
    [entries, range.todayKey],
  );
  /** Day i's Anytime tasks. */
  const anytimeOf = (i: number) => anytimeByDay.get(range.keys[i]) ?? NO_TASKS;

  // Manual edges from the stretch handles, per day, with the day's tasks as they were then
  // (`sig`). Once a task on that day is added, moved or removed, the stretch no longer applies and
  // the grid hugs its tasks again (DayGrid animates the change).
  const [stretches, setStretches] = useState<Map<string, { edges: WindowStretch; sig: string }>>(
    () => new Map(),
  );
  // Each day's window: its tasks' span (see dayWindow) with any still-valid manual edges applied.
  const windows = useMemo(
    () =>
      range.keys.map((k) => {
        const dayEntries = timedByDay.get(k) ?? NO_ENTRIES;
        const base = dayWindow(dayEntries);
        const stretch = stretches.get(k);
        const edges = stretch?.sig === tasksSig(dayEntries) ? stretch.edges : undefined;
        return base && applyStretch(base, edges, contentBounds(dayEntries));
      }),
    [range, timedByDay, stretches],
  );

  // Content starts under the floating header. On iOS the list already insets for the status bar
  // (contentInsetAdjustmentBehavior), so only the rest of the header needs a spacer.
  const spacer = Math.max(0, headerHeight - (Platform.OS === 'ios' ? insets.top : 0));
  const minOffset = spacer - headerHeight;

  /** Height of day i's all-day card (every day has one; see anytime-list). */
  const anytimeSection = (i: number) => anytimeHeight(anytimeOf(i).length);

  // Where each day section starts (prefix sums); starts[i + 1] - starts[i] is day i's height.
  const starts = useMemo(() => {
    const s = [spacer];
    for (let i = 0; i < range.days.length; i++) {
      const key = range.keys[i];
      const allDay = anytimeHeight(anytimeByDay.get(key)?.length ?? 0);
      s.push(s[i] + DAY_LABEL_H + allDay + cardHeight(windows[i]) + DAY_GAP);
    }
    return s;
  }, [range, anytimeByDay, spacer, windows]);

  /** Content y of the top of day i's window (its first visible minute). */
  const gridTop = (i: number) =>
    starts[i] + DAY_LABEL_H + anytimeSection(i) + EDGE_HANDLE_H + GRID_PAD_Y;

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
    const sig = tasksSig(timedByDay.get(key) ?? NO_ENTRIES);
    setStretches((prev) => {
      const kept = prev.get(key);
      const edges = kept?.sig === sig ? kept.edges : {};
      return new Map(prev).set(key, {
        sig,
        edges: { ...edges, [edge === 'top' ? 'startMin' : 'endMin']: minutes },
      });
    });
  };

  const handleScroll = (y: number) => {
    offsetRef.current = y;
    // The canvas moved under a held task (auto-scroll): what's under the finger changed.
    if (dragRef.current) dragFns.current.hover(fingerRef.current);
    const day = dayAt(y + headerHeight + 1);
    if (day !== visibleRef.current) {
      visibleRef.current = day;
      onVisibleDayChange(range.keys[day]);
    }
  };

  // ---- Dragging a task: an Anytime row or a planner block ----------------------------------------
  // Rows and blocks hand their long-press drag to the canvas: their gesture moves the floating copy
  // on the UI thread and reports the finger here. This works out the drop target from the computed
  // layout (a slot on any day's grid, or any day's Anytime list), shows grid targets as a preview
  // block in that grid, and auto-scrolls near the top/bottom of the screen.
  const { width: screenWidth } = useWindowDimensions();
  // All-day rows sit in the card's lane, like blocks (left edge on screen, width).
  const laneLeft = PAGE_PAD_X + ANYTIME_LANE_LEFT;
  const rowWidth = screenWidth - PAGE_PAD_X * 2 - ANYTIME_LANE_INSET;
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const [target, setTarget] = useState<DropTarget>(null);
  const targetRef = useRef<DropTarget>(null);
  const lookRef = useRef<GhostTask['look']>('row');
  const fingerRef = useRef(0);
  const [dropping, setDropping] = useState(false);
  // An Anytime task dropped elsewhere: its row (or, for another day's only task, its whole
  // section) collapses (0 → 1) before the task moves. If that's above the visible area, the canvas
  // scrolls by the same amount so nothing moves.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removeProgress = useSharedValue(0);
  const removeAnchor = useSharedValue(0);
  const removeShift = useSharedValue(0);
  // A task dropped into a day's Anytime list: its new row (or, for a day that had none, the whole
  // section) grows in (0 → 1).
  const [addingId, setAddingId] = useState<string | null>(null);
  const addProgress = useSharedValue(0);
  // Days that just got a grid (it grows out of the "Drop to schedule" box), and one that just lost
  // its only block (its grid shrinks into "Nothing scheduled" as `shrinkProgress` goes 0 → 1,
  // with the canvas scrolling in step if it's above the view). Also a day whose last all-day task
  // just left (its empty box pops in).
  const [growing, setGrowing] = useState<string | null>(null);
  const [shrinking, setShrinking] = useState<{ key: string; window: TimeWindow } | null>(null);
  const shrinkProgress = useSharedValue(0);
  const shrinkAnchor = useSharedValue(0);
  const shrinkShift = useSharedValue(0);
  const pendingShrinkShift = useRef(0);
  const [emptied, setEmptied] = useState<string | null>(null);
  // Auto-scroll on the UI thread while a task is held near the top or bottom of the screen.
  const zoneTop = useSharedValue(0);
  const zoneBottom = useSharedValue(0);
  const minScroll = useSharedValue(0);
  useEffect(() => {
    zoneTop.set(headerHeight + AUTO_ZONE);
    zoneBottom.set(viewportHeight - tabBarSpace - AUTO_ZONE);
    minScroll.set(minOffset);
  }, [headerHeight, viewportHeight, tabBarSpace, minOffset, zoneTop, zoneBottom, minScroll]);
  const armed = useSharedValue(false);
  const autoScrolling = useSharedValue(false);
  const autoY = useSharedValue(0);
  const autoScroll = useFrameCallback((frame) => {
    'worklet';
    const fy = dragLayer.fingerY.get();
    if (!armed.get()) {
      if (Math.abs(fy - dragLayer.liftY.get()) < ARM_DISTANCE) return;
      armed.set(true);
    }
    let v = 0; // -1..1, eased below
    if (fy < zoneTop.get()) v = -Math.min(1, (zoneTop.get() - fy) / AUTO_ZONE);
    else if (fy > zoneBottom.get()) v = Math.min(1, (fy - zoneBottom.get()) / AUTO_ZONE);
    if (v === 0) {
      if (autoScrolling.get()) autoScrolling.set(false);
      return;
    }
    if (!autoScrolling.get()) {
      autoScrolling.set(true);
      autoY.set(scrollY.get());
    }
    const dt = frame.timeSincePreviousFrame ?? 16;
    const next = Math.max(minScroll.get(), autoY.get() + v * Math.abs(v) * AUTO_MAX_SPEED * dt);
    autoY.set(next);
    scrollTo(listRef, 0, next, false);
  }, false);

  /** Where the task would land if dropped at screen y (see DropTarget). */
  const hitTest = (fingerY: number, d: ActiveDrag): DropTarget => {
    if (fingerY < headerHeight) return null;
    const y = offsetRef.current + fingerY;
    const i = dayAt(y);
    const cardTop = starts[i] + DAY_LABEL_H + anytimeSection(i);
    // The date label and the Anytime list both mean "this day, anytime", at the gap between rows
    // nearest the finger. A row dropped back on its own day just goes back.
    if (y < cardTop) {
      if (d.source === 'anytime' && i === d.sourceDay) return null;
      const n = anytimeOf(i).length;
      const listTop = starts[i] + DAY_LABEL_H + ANYTIME_PAD;
      const gap = Math.round((y - listTop) / (ANYTIME_ROW_H + ANYTIME_ROW_GAP));
      return { kind: 'anytime', day: i, index: Math.max(0, Math.min(n, gap)) };
    }
    const w = windows[i];
    if (y >= cardTop + cardHeight(w)) return null;
    if (!w) return { kind: 'newGrid', day: i };
    // Keep the point the finger holds under the finger, snapped, inside the window and before
    // 11:59 PM.
    const minute = w.startMin + (y - cardTop - EDGE_HANDLE_H - GRID_PAD_Y) / PX_PER_MIN;
    const snapped = Math.round((minute - d.anchorMin) / SNAP_MIN) * SNAP_MIN;
    const latest = Math.min(
      SCHEDULE_MAX_END - d.durationMin,
      Math.max(w.startMin, w.endMin - d.durationMin),
    );
    return { kind: 'grid', day: i, startMin: Math.max(w.startMin, Math.min(latest, snapped)) };
  };

  /** The floating copy's look and size for a drag. */
  const ghostFor = (d: ActiveDrag, look: GhostTask['look']): GhostTask => ({
    title: d.title,
    done: d.done,
    isList: d.isList,
    hasNotes: d.hasNotes,
    look,
    width: look === 'row' || !d.home ? rowWidth : d.home.width,
    height: look === 'row' || !d.home ? ANYTIME_ROW_H : d.home.height,
    startMin: d.home?.startMin ?? 0,
    endMin: (d.home?.startMin ?? 0) + d.durationMin,
  });

  /** Switch the copy between row and block looks, keeping it under the finger. */
  const setLook = (d: ActiveDrag, look: GhostTask['look']) => {
    if (look === lookRef.current) return;
    lookRef.current = look;
    const fx = dragLayer.fingerX.get();
    const fy = dragLayer.fingerY.get();
    if (look === 'row' || !d.home) {
      // Rows line up with the lane, held by their middle.
      dragLayer.grabX.set(fx - laneLeft);
      dragLayer.grabY.set(ANYTIME_ROW_H / 2);
    } else {
      dragLayer.grabX.set(d.home.grabX);
      dragLayer.grabY.set(d.anchorMin * PX_PER_MIN);
    }
    dragLayer.x.set(fx - dragLayer.grabX.get());
    dragLayer.y.set(fy - dragLayer.grabY.get());
    onDragTaskChange(ghostFor(d, look));
  };

  const updateTarget = (fingerY: number) => {
    fingerRef.current = fingerY;
    const d = dragRef.current;
    if (d) applyTarget(d, hitTest(fingerY, d));
  };

  /** Show `next` as the drop target (preview, highlight, haptic, the floating copy's look). */
  const applyTarget = (d: ActiveDrag, next: DropTarget) => {
    const prev = targetRef.current;
    if (targetKey(next) === targetKey(prev)) return;
    targetRef.current = next;
    setTarget(next);
    if (next) haptics.tick();
    // Over a grid the task shows as a preview block there, so the floating copy fades out;
    // anywhere else it looks like an all-day task.
    const onGrid = next?.kind === 'grid';
    if (onGrid !== (prev?.kind === 'grid')) {
      dragLayer.opacity.set(withTiming(onGrid ? 0 : 1, { duration: 120 }));
    }
    setLook(d, 'row');
  };

  const finishDrag = () => {
    removeShift.set(0);
    dragRef.current = null;
    targetRef.current = null;
    setDrag(null);
    onDragTaskChange(null);
    setTarget(null);
    setDropping(false);
    setRemovingId(null);
    setDragging(false);
  };

  /** Clear a one-off animation flag once its animation is over (so a re-render doesn't replay it). */
  const clearLater = (clear: () => void) => setTimeout(clear, MORPH_MS + 80);

  /** A day without a grid just got one: it grows out of its "Drop to schedule" box. */
  const growGrid = (day: number) => {
    const key = range.keys[day];
    setGrowing(key);
    clearLater(() => setGrowing((k) => (k === key ? null : k)));
  };

  /** A block left `day`: if it was that day's only one, its grid shrinks away. */
  const shrinkGridIfEmptied = (day: number) => {
    const w = windows[day];
    if (!w) return;
    if ((timedByDay.get(range.keys[day])?.length ?? 0) !== 1) return;
    const from = dayGridHeight(w);
    const bottom = starts[day] + DAY_LABEL_H + anytimeSection(day) + from;
    pendingShrinkShift.current =
      bottom <= offsetRef.current + headerHeight ? from - EMPTY_CARD_H : 0;
    shrinkShift.set(0);
    shrinkProgress.set(0);
    setShrinking({ key: range.keys[day], window: w });
  };
  // Start shrinking once the shell is rendered (at 0), so the scroll and height move together.
  useEffect(() => {
    if (!shrinking) return;
    shrinkAnchor.set(scrollY.get());
    shrinkShift.set(pendingShrinkShift.current);
    shrinkProgress.set(
      withTiming(1, { duration: MORPH_MS }, () => {
        'worklet';
        scheduleOnRN(setShrinking, null);
      }),
    );
  }, [shrinking, shrinkAnchor, shrinkShift, shrinkProgress, scrollY]);
  useAnimatedReaction(
    () => shrinkProgress.get(),
    (p) => {
      const shift = shrinkShift.get();
      if (shift) scrollTo(listRef, 0, shrinkAnchor.get() - shift * p, false);
    },
  );

  /** An all-day task left `day`: if it was the last one, the empty box pops in. */
  const popEmptyIfEmptied = (day: number) => {
    if (anytimeOf(day).length !== 1) return;
    const key = range.keys[day];
    setEmptied(key);
    clearLater(() => setEmptied((k) => (k === key ? null : k)));
  };

  /**
   * A task joins a day's all-day list: its row grows in (or, replacing the empty box, pops in).
   */
  const growInto = (id: string, day: number) => {
    addProgress.set(0);
    setAddingId(id);
    addProgress.set(
      withTiming(1, { duration: 240 }, () => {
        'worklet';
        scheduleOnRN(setAddingId, null);
      }),
    );
  };

  /** A day without a grid gets one: the dropped block starts at the default day start. */
  const newGridStart = () => Math.round(schedule.dayStartMin / SNAP_MIN) * SNAP_MIN;

  /** Put a task into a day's Anytime list at `index` (before the task now there). */
  const dropIntoAnytime = (id: string, day: number, index: number) => {
    onUnscheduleItem(id, range.days[day], anytimeOf(day)[index]?.id ?? null);
    growInto(id, day);
  };

  /** Land a lifted Anytime row: on a grid slot, a new grid, or in another day's list. */
  const commitAnytime = (id: string, drop: NonNullable<DropTarget>) => {
    if (drop.kind === 'anytime') dropIntoAnytime(id, drop.day, drop.index);
    else {
      if (drop.kind === 'newGrid') growGrid(drop.day);
      const start = drop.kind === 'grid' ? drop.startMin : newGridStart();
      onScheduleItem(id, range.days[drop.day], start, DROP_DURATION_MIN);
    }
    finishDrag();
  };

  const startDrag = (source: DragSource) => {
    let d: ActiveDrag | null = null;
    if (source.kind === 'anytime') {
      for (const [key, list] of anytimeByDay) {
        const t = list.find((a) => a.id === source.id);
        if (!t) continue;
        d = {
          id: t.id,
          title: t.title,
          done: t.done,
          isList: t.isList,
          hasNotes: t.hasNotes,
          source: 'anytime',
          sourceDay: range.indexOf.get(key) ?? range.todayIndex,
          durationMin: DROP_DURATION_MIN,
          anchorMin: DROP_DURATION_MIN / 2, // a new block is centred on the finger
          home: null,
        };
        break;
      }
    } else {
      for (const [key, list] of timedByDay) {
        const e = list.find((x) => x.id === source.id);
        if (!e) continue;
        const day = range.indexOf.get(key) ?? range.todayIndex;
        d = {
          id: e.id,
          title: e.title,
          done: e.done,
          isList: e.isList,
          hasNotes: e.hasNotes,
          source: 'block',
          sourceDay: day,
          durationMin: e.endMin - e.startMin,
          anchorMin: source.anchorMin,
          home: {
            day,
            startMin: e.startMin,
            x: source.x,
            grabX: dragLayer.grabX.get(),
            width: source.width,
            height: source.height,
          },
        };
        break;
      }
    }
    if (!d) return;
    dragRef.current = d;
    targetRef.current = null;
    // The floating copy always looks like an all-day task (a grid shows a block preview instead).
    lookRef.current = d.source === 'anytime' ? 'row' : 'block';
    setDrag(d);
    onDragTaskChange(ghostFor(d, lookRef.current));
    setLook(d, 'row');
    setDragging(true);
    armed.set(false);
    autoScrolling.set(false);
    autoScroll.setActive(true);
  };

  const endDrag = (canceled: boolean) => {
    autoScroll.setActive(false);
    autoScrolling.set(false);
    const d = dragRef.current;
    if (!d) return;
    const drop = canceled ? null : targetRef.current;
    const fromList = anytimeOf(d.sourceDay);
    const rowIndex = fromList.findIndex((a) => a.id === d.id);
    const rowTop = starts[d.sourceDay] + DAY_LABEL_H + anytimeRowTop(Math.max(0, rowIndex));

    if (drop && d.source === 'anytime' && rowIndex >= 0) {
      // Collapse the row first, then land the task (see removeProgress).
      setDropping(true);
      dragLayer.opacity.set(withTiming(0, { duration: 150 }));
      if (fromList.length === 1) {
        // Its list's last task: the empty box takes its place (same height) and pops in.
        popEmptyIfEmptied(d.sourceDay);
        commitAnytime(d.id, drop);
        return;
      }
      const collapsed = ANYTIME_ROW_H + ANYTIME_ROW_GAP;
      const bottom = rowTop + ANYTIME_ROW_H;
      const aboveView = bottom <= offsetRef.current + headerHeight;
      removeShift.set(0);
      removeProgress.set(0);
      removeAnchor.set(scrollY.get());
      removeShift.set(aboveView ? collapsed : 0);
      setRemovingId(d.id);
      removeProgress.set(
        withTiming(1, { duration: 240 }, () => {
          'worklet';
          scheduleOnRN(commitAnytime, d.id, drop);
        }),
      );
      return;
    }

    if (drop && d.source === 'block') {
      dragLayer.opacity.set(withTiming(0, { duration: 150 }));
      if (!(drop.kind === 'grid' && drop.day === d.sourceDay)) shrinkGridIfEmptied(d.sourceDay);
      if (drop.kind === 'newGrid') growGrid(drop.day);
      if (drop.kind === 'anytime') {
        // Its new row grows in at that spot in the day's list while the copy fades away.
        dropIntoAnytime(d.id, drop.day, drop.index);
      } else {
        const start = drop.kind === 'grid' ? drop.startMin : newGridStart();
        if (d.home?.day !== drop.day || d.home.startMin !== start) {
          onMoveItemTo(d.id, range.days[drop.day], start);
        }
      }
      finishDrag();
      return;
    }

    // Nowhere to land: fly back to where it was picked up and settle in.
    let homeX = laneLeft;
    let homeY = rowTop;
    if (d.home) {
      const w = windows[d.home.day];
      homeX = d.home.x;
      homeY = gridTop(d.home.day) + (d.home.startMin - (w?.startMin ?? 0)) * PX_PER_MIN;
      setLook(d, 'block');
    }
    dragLayer.opacity.set(withTiming(1, { duration: 120 }));
    dragLayer.x.set(withSpring(homeX, BACK_SPRING));
    dragLayer.y.set(
      withSpring(homeY - offsetRef.current, BACK_SPRING, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finishDrag);
      }),
    );
  };

  // Gesture callbacks always reach the latest render's functions (layout, windows, tasks).
  const dragFns = useRef({ start: startDrag, hover: updateTarget, end: endDrag });
  useLayoutEffect(() => {
    dragFns.current = { start: startDrag, hover: updateTarget, end: endDrag };
  });
  // The layout changed under a held task: re-check what's under the finger.
  useEffect(() => {
    if (dragRef.current) dragFns.current.hover(fingerRef.current);
  }, [starts]);

  const dragHandlers = useMemo<TaskDragHandlers>(
    () => ({
      layer: dragLayer,
      onStart: (source) => dragFns.current.start(source),
      onMove: (y) => dragFns.current.hover(y),
      onEnd: (canceled) => dragFns.current.end(canceled),
    }),
    [dragLayer],
  );

  // Collapsing row above the visible area: scroll in step so the visible content stays still.
  useAnimatedReaction(
    () => removeProgress.get(),
    (p) => {
      const shift = removeShift.get();
      if (shift) scrollTo(listRef, 0, removeAnchor.get() - shift * p, false);
    },
  );

  const extraData = useMemo(
    () => [
      windows,
      target,
      drag,
      dropping,
      removingId,
      addingId,
      anytimeByDay,
      growing,
      shrinking,
      emptied,
    ],
    [
      windows,
      target,
      drag,
      dropping,
      removingId,
      addingId,
      anytimeByDay,
      growing,
      shrinking,
      emptied,
    ],
  );

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
        extraData={extraData}
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
            anytime={anytimeOf(index)}
            drag={dragHandlers}
            draggingId={drag?.id ?? null}
            dragActive={drag !== null}
            anytimeInsert={target?.kind === 'anytime' && target.day === index ? target.index : null}
            newGridTarget={target?.kind === 'newGrid' && target.day === index}
            removingId={removingId}
            removeProgress={removeProgress}
            addingId={addingId}
            addProgress={addProgress}
            growIn={growing === range.keys[index]}
            shrinkWindow={shrinking?.key === range.keys[index] ? shrinking.window : null}
            shrinkProgress={shrinkProgress}
            emptyAppear={emptied === range.keys[index]}
            preview={
              drag && target?.kind === 'grid' && target.day === index
                ? {
                    title: drag.title,
                    isList: drag.isList,
                    hasNotes: drag.hasNotes,
                    startMin: target.startMin,
                    endMin: target.startMin + drag.durationMin,
                    lifted: !dropping,
                  }
                : null
            }
            onToggleDone={onToggleDone}
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
  drag: TaskDragHandlers;
  draggingId: string | null;
  /** A task is being dragged: missing sections show as dotted drop boxes. */
  dragActive: boolean;
  /** A held task would land in this day's Anytime list at this position. */
  anytimeInsert: number | null;
  /** A held task would land on this day's (not yet existing) grid. */
  newGridTarget: boolean;
  removingId: string | null;
  removeProgress: SharedValue<number>;
  addingId: string | null;
  addProgress: SharedValue<number>;
  /** Its grid was just created: it grows out of the empty box. */
  growIn: boolean;
  /** Its grid was just emptied: this was its window, shrinking into the empty box. */
  shrinkWindow: TimeWindow | null;
  shrinkProgress: SharedValue<number>;
  /** Its last all-day task just left: the empty box pops in. */
  emptyAppear: boolean;
  preview: DropPreview | null;
  onToggleDone: (id: string) => void;
  onDragChange: (dragging: boolean) => void;
  onEdgeCommit: (edge: Edge, minutes: number) => void;
}

/** One day: its label, its Anytime tasks, and its grid. Heights are computed, not measured. */
function DaySection({
  date,
  isToday,
  entries,
  window,
  anytime,
  drag,
  draggingId,
  dragActive,
  anytimeInsert,
  newGridTarget,
  removingId,
  removeProgress,
  addingId,
  addProgress,
  growIn,
  shrinkWindow,
  shrinkProgress,
  emptyAppear,
  preview,
  onToggleDone,
  onDragChange,
  onEdgeCommit,
}: DaySectionProps) {
  const label = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const grid = (w: TimeWindow, gridEntries: TimelineEntry[]) => (
    <DayGrid
      window={w}
      entries={gridEntries}
      isToday={isToday}
      drag={drag}
      draggingId={draggingId}
      onToggleDone={onToggleDone}
      onDragChange={onDragChange}
      onEdgeCommit={onEdgeCommit}
      dropPreview={preview}
    />
  );

  return (
    <View>
      <View style={{ height: DAY_LABEL_H }} className="flex-row items-end gap-2 px-1 pb-2">
        {isToday && <Text className="text-subhead text-accent font-semibold">Today</Text>}
        <Text className="text-subhead text-muted font-semibold">{label}</Text>
      </View>

      {anytime.length === 0 && !window && !dragActive && !shrinkWindow && !emptyAppear ? (
        // A day with nothing at all: one card the size of both empty ones (and the gap between),
        // so it can split into the two drop boxes when a drag starts without moving anything.
        <EmptyCard label="Nothing scheduled" height={anytimeHeight(0) + EMPTY_CARD_H} />
      ) : (
        <>
          <AnytimeList
            tasks={anytime}
            onToggleDone={onToggleDone}
            drag={drag}
            dragActive={dragActive}
            draggingId={draggingId}
            insertAt={anytimeInsert}
            removingId={removingId}
            removeProgress={removeProgress}
            addingId={addingId}
            addProgress={addProgress}
            emptyAppear={emptyAppear}
          />

          {window ? (
            growIn ? (
              <GrowIn from={EMPTY_CARD_H} to={dayGridHeight(window)}>
                {grid(window, entries)}
              </GrowIn>
            ) : (
              grid(window, entries)
            )
          ) : shrinkWindow ? (
            <ShrinkOut
              from={dayGridHeight(shrinkWindow)}
              to={EMPTY_CARD_H}
              progress={shrinkProgress}
              replacement={<EmptyCard label="Nothing scheduled" height={EMPTY_CARD_H} />}
            >
              {grid(shrinkWindow, NO_ENTRIES)}
            </ShrinkOut>
          ) : dragActive ? (
            // No grid yet: while dragging, a box stands in for it (drop creates it).
            <DropBox
              label="Drop to schedule"
              highlighted={newGridTarget}
              style={{ height: EMPTY_CARD_H }}
            />
          ) : (
            <EmptyCard label="Nothing scheduled" height={EMPTY_CARD_H} />
          )}
        </>
      )}
      <View style={{ height: DAY_GAP }} />
    </View>
  );
}
