import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';

import { useDayEntries } from '@/db/entries';
import { getTask } from '@/db/occurrences';
import { clearAllDaysTime, setAllDaysTime } from '@/db/recurring';
import { moveTask, scheduleTask, taskTimes, toggleDone, unscheduleTask } from '@/db/tasks';
import { askScope } from '@/lib/ask-scope';
import { useTodayKey } from '@/lib/today';

import { DateHeader } from './date-header';
import { DayCanvas, type DayCanvasHandle } from './day-canvas';
import { buildDayRange } from './day-range';
import { MINUTES_PER_DAY } from './time';
import { DragGhost, type GhostTask } from './drag-ghost';
import { useDragLayer } from './drag-layer';

/**
 * The day view: a sticky date header floating over an infinite canvas of days.
 * The two stay in sync: scrolling the canvas into a day selects it in the header, and picking a
 * date in the header jumps the canvas there.
 *
 * Rebuilt from scratch when the date changes (past midnight, or reopened on a later day), so it
 * always opens on today.
 */
export function DayViewScreen() {
  const todayKey = useTodayKey();
  return <DayView key={todayKey} />;
}

/**
 * Drops onto the canvas. A recurring task's day asks first: this day only (that day moves), or all
 * days (every day gets the new time; the day it was dropped on doesn't matter then).
 */
const repeating = (id: string) => {
  const task = getTask(id);
  return task?.series_id ? task : null;
};

function scheduleItem(id: string, day: Date, startMin: number, durationMin: number) {
  const task = repeating(id);
  if (!task) return scheduleTask(id, day, startMin, durationMin);
  void askScope('Give this repeating task a time?').then((scope) => {
    if (scope === 'one') scheduleTask(id, day, startMin, durationMin);
    if (scope === 'all') setAllDaysTime(task, startMin, startMin + durationMin);
  });
}

function moveItemTo(id: string, day: Date, startMin: number) {
  const task = repeating(id);
  // Same time on another day: only that day can move ("all days" changes just the time).
  if (!task || taskTimes(task)?.start === startMin) return moveTask(id, day, startMin);
  void askScope('Move this repeating task?').then((scope) => {
    if (scope === 'one') moveTask(id, day, startMin);
    const times = taskTimes(task);
    // A later piece dropped near midnight can put the start on the day before: same clock time.
    const start = ((startMin % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (scope === 'all' && times) setAllDaysTime(task, start, start + times.end - times.start);
  });
}

function unscheduleItem(id: string, day: Date, beforeId: string | null) {
  const task = repeating(id);
  if (!task) return unscheduleTask(id, day, beforeId);
  // Already all-day (moved within the all-day lists): only that day can move.
  if (!task.start_at) return unscheduleTask(id, day, beforeId);
  void askScope('Make this repeating task all-day?').then((scope) => {
    if (scope === 'one') unscheduleTask(id, day, beforeId);
    if (scope === 'all') clearAllDaysTime(task);
  });
}

function DayView() {
  const range = useMemo(() => buildDayRange(), []);
  const [selected, setSelected] = useState(range.todayKey);
  const entries = useDayEntries();
  const [headerHeight, setHeaderHeight] = useState(0);
  const canvasRef = useRef<DayCanvasHandle>(null);

  // While a block, grid edge or Anytime task is being dragged, swiping between tabs is paused so a sideways
  // wobble in the drag can't start turning the page.
  const navigation = useNavigation();
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    navigation.setOptions({ swipeEnabled: !dragging });
  }, [navigation, dragging]);

  // Dragging a task (Anytime row or block): its floating copy is drawn here, above the header.
  const dragLayer = useDragLayer();
  const [dragTask, setDragTask] = useState<GhostTask | null>(null);
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const measureRoot = () =>
    rootRef.current?.measureInWindow((x, y) => {
      dragLayer.rootX.set(x);
      dragLayer.rootY.set(y);
    });

  const pickDay = (key: string) => {
    setSelected(key);
    canvasRef.current?.scrollToDay(key);
  };

  return (
    <View ref={rootRef} onLayout={measureRoot} className="bg-app flex-1">
      <DayCanvas
        ref={canvasRef}
        range={range}
        entries={entries}
        headerHeight={headerHeight}
        onVisibleDayChange={setSelected}
        onDraggingChange={setDragging}
        onToggleDone={toggleDone}
        onScheduleItem={scheduleItem}
        onMoveItemTo={moveItemTo}
        onUnscheduleItem={unscheduleItem}
        dragLayer={dragLayer}
        onDragTaskChange={setDragTask}
      />
      <DateHeader
        range={range}
        selected={selected}
        onSelect={pickDay}
        onHeightChange={setHeaderHeight}
      />
      <DragGhost layer={dragLayer} task={dragTask} />
    </View>
  );
}
