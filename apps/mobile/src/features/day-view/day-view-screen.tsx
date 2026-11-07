import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { DateHeader } from './date-header';
import { DayCanvas, type DayCanvasHandle } from './day-canvas';
import { moveItem } from './day-entries';
import { buildDayRange } from './day-range';
import { mockDayEntries } from './mock-data';

/**
 * The day view: a sticky date header floating over an infinite canvas of days.
 * The two stay in sync: scrolling the canvas into a day selects it in the header, and picking a
 * date in the header jumps the canvas there.
 */
export function DayViewScreen() {
  const range = useMemo(() => buildDayRange(), []);
  const [selected, setSelected] = useState(range.todayKey);
  const [entries, setEntries] = useState(mockDayEntries);
  const [headerHeight, setHeaderHeight] = useState(0);
  const canvasRef = useRef<DayCanvasHandle>(null);

  const pickDay = (key: string) => {
    setSelected(key);
    canvasRef.current?.scrollToDay(key);
  };

  return (
    <View className="bg-app flex-1">
      <DayCanvas
        ref={canvasRef}
        range={range}
        entries={entries}
        headerHeight={headerHeight}
        onVisibleDayChange={setSelected}
        onMoveItem={(id, startMin) => setEntries((prev) => moveItem(prev, id, startMin))}
      />
      <DateHeader
        range={range}
        selected={selected}
        onSelect={pickDay}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
