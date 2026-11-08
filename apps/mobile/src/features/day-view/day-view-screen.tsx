import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';

import { usePlannerStore } from '@/lib/planner-store';

import { DateHeader } from './date-header';
import { DayCanvas, type DayCanvasHandle } from './day-canvas';
import { moveItemTo, scheduleItem, toggleItemDone, unscheduleItem } from './day-entries';
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
  const { entries, setEntries } = usePlannerStore();
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
        onToggleDone={(id) => setEntries((prev) => toggleItemDone(prev, id))}
        onScheduleItem={(id, day, startMin, durationMin) =>
          setEntries((prev) => scheduleItem(prev, id, day, startMin, durationMin))
        }
        onMoveItemTo={(id, day, startMin) =>
          setEntries((prev) => moveItemTo(prev, id, day, startMin))
        }
        onUnscheduleItem={(id, day, beforeId) =>
          setEntries((prev) => unscheduleItem(prev, id, day, beforeId))
        }
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
