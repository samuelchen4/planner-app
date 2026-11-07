import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useColors } from '@/lib/theme';

import { layoutColumns } from './layout';
import { formatHour, minutesOfDay } from './time';
import {
  GRID_PAD_Y,
  GUTTER_WIDTH,
  MIN_BLOCK_MIN,
  PX_PER_MIN,
  type TimelineEntry,
  type TimeWindow,
} from './timeline-constants';
import { TimelineBlock } from './timeline-block';

const LABEL_HEIGHT = 16;
const NOW_DOT = 10;

interface Props {
  entries: TimelineEntry[];
  /** The slice of the day to draw; blocks and the now line are positioned relative to its start. */
  window: TimeWindow;
  onMove: (id: string, startMin: number) => void;
  onDragChange: (dragging: boolean) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Draw the current-time line (only when the grid shows today). */
  showNow?: boolean;
}

/** A day's grid for one time window: hour lines, a line at the current time, and the day's blocks. */
export function Timeline({
  entries,
  window,
  onMove,
  onDragChange,
  onLayout,
  showNow = true,
}: Props) {
  const colors = useColors();
  const nowMin = useNowMinutes();
  const placed = useMemo(() => layoutColumns(entries, MIN_BLOCK_MIN), [entries]);
  const y = (minutes: number) => (minutes - window.startMin) * PX_PER_MIN;

  // Whole hours inside the window, e.g. 7…22 for 7:00 AM – 10:00 PM.
  const hours: number[] = [];
  for (let h = Math.ceil(window.startMin / 60); h * 60 <= window.endMin; h++) hours.push(h);
  const nowVisible = showNow && nowMin >= window.startMin && nowMin <= window.endMin;

  return (
    <View
      style={[styles.container, { height: (window.endMin - window.startMin) * PX_PER_MIN }]}
      onLayout={onLayout}
    >
      {hours.map((hour) => (
        <HourRow key={hour} hour={hour} y={y(hour * 60)} />
      ))}

      <View style={styles.lane}>
        {placed.map(({ item, column, columns }) => (
          <TimelineBlock
            key={item.id}
            entry={item}
            column={column}
            columns={columns}
            window={window}
            onMove={onMove}
            onDragChange={onDragChange}
          />
        ))}
      </View>

      {nowVisible && (
        <View pointerEvents="none" style={[styles.nowRow, { top: y(nowMin) - NOW_DOT / 2 }]}>
          <View style={[styles.nowDot, { backgroundColor: colors.danger }]} />
          <View style={[styles.nowLine, { backgroundColor: colors.danger }]} />
        </View>
      )}
    </View>
  );
}

/** One hour line with its label, centred on `y` (absolutely positioned in its parent). */
export function HourRow({ hour, y }: { hour: number; y: number }) {
  const colors = useColors();
  return (
    <View pointerEvents="none" style={[styles.hourRow, { top: y - LABEL_HEIGHT / 2 }]}>
      <Text numberOfLines={1} className="text-caption text-subtle" style={styles.hourLabel}>
        {formatHour(hour)}
      </Text>
      <View style={[styles.hourLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** Minutes since midnight, refreshed at the top of every minute. */
export function useNowMinutes() {
  const [now, setNow] = useState(() => minutesOfDay(new Date().toISOString()));
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(minutesOfDay(new Date().toISOString()));
    const timeout = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

const styles = StyleSheet.create({
  container: { marginVertical: GRID_PAD_Y },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: LABEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: GUTTER_WIDTH - 6,
    textAlign: 'right',
    marginRight: 6,
    fontVariant: ['tabular-nums'],
  },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth },
  lane: { position: 'absolute', top: 0, bottom: 0, left: GUTTER_WIDTH, right: 0 },
  nowRow: {
    position: 'absolute',
    left: GUTTER_WIDTH - NOW_DOT / 2,
    right: 0,
    height: NOW_DOT,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  nowDot: { width: NOW_DOT, height: NOW_DOT, borderRadius: NOW_DOT / 2 },
  nowLine: { flex: 1, height: 2 },
});
