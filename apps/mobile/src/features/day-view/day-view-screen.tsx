import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';

import { useDayEntries } from '@/db/entries';
import { moveTask, scheduleTask, toggleDone, unscheduleTask } from '@/db/tasks';

import { DateHeader } from './date-header';
import { DayCanvas, type DayCanvasHandle } from './day-canvas';
import { buildDayRange } from './day-range';
import { DragGhost, type GhostTask } from './drag-ghost';
import { useDragLayer } from './drag-layer';

/**
 * The day view: a sticky date header floating over an infinite canvas of days.
 * The two stay in sync: scrolling the canvas into a day selects it in the header, and picking a
 * date in the header jumps the canvas there.
 */
export function DayViewScreen() {
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
        onScheduleItem={scheduleTask}
        onMoveItemTo={moveTask}
        onUnscheduleItem={unscheduleTask}
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
