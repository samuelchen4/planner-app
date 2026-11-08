import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';

import type { TaskDragHandlers } from './drag-layer';
import { layoutColumns } from './layout';
import { formatHour, MINUTES_PER_DAY, minutesOfDay } from './time';
import {
  GUTTER_WIDTH,
  MIN_BLOCK_MIN,
  PX_PER_MIN,
  type TimelineEntry,
} from './timeline-constants';
import { PreviewBlock, TimelineBlock, type DropPreview } from './timeline-block';

const LABEL_HEIGHT = 16;
const NOW_DOT = 10;

interface Props {
  entries: TimelineEntry[];
  drag: TaskDragHandlers;
  /** The lifted task, if it's one of this day's blocks (drawn faded in place). */
  draggingId: string | null;
  onToggleDone: (id: string) => void;
  /** Draw the current-time line (only when the grid shows today). */
  showNow?: boolean;
  /** An Anytime task being dragged over this day: where it would land. */
  preview?: DropPreview | null;
}

// Every hour line of the day (midnight sits above the earliest possible window, 12:01 AM).
const HOURS = Array.from({ length: 23 }, (_, i) => i + 1);

/**
 * A whole day's grid: hour lines, the day's blocks and the current-time line, all at absolute
 * time-of-day positions (minute 0 at the top, MINUTES_PER_DAY tall). The parent shows a slice of
 * it by clipping and offsetting, so changing the visible window never moves anything in here.
 */
export function Timeline({
  entries,
  drag,
  draggingId,
  onToggleDone,
  showNow = true,
  preview,
}: Props) {
  const colors = useColors();
  const nowMin = useNowMinutes();
  const placed = useMemo(() => layoutColumns(entries, MIN_BLOCK_MIN), [entries]);

  return (
    <View style={styles.day}>
      {HOURS.map((hour) => (
        <HourRow key={hour} hour={hour} y={hour * 60 * PX_PER_MIN} />
      ))}

      <View style={styles.lane}>
        {placed.map(({ item, column, columns }) => (
          <TimelineBlock
            key={item.id}
            entry={item}
            column={column}
            columns={columns}
            drag={drag}
            faded={item.id === draggingId}
            onToggleDone={onToggleDone}
          />
        ))}
        {preview && <PreviewBlock {...preview} />}
      </View>

      {showNow && (
        <View
          pointerEvents="none"
          style={[styles.nowRow, { top: nowMin * PX_PER_MIN - NOW_DOT / 2 }]}
        >
          <View style={[styles.nowDot, { backgroundColor: colors.danger }]} />
          <View style={[styles.nowLine, { backgroundColor: colors.danger }]} />
        </View>
      )}
    </View>
  );
}

/** One hour line with its label, centred on `y` (absolutely positioned in its parent). */
function HourRow({ hour, y }: { hour: number; y: number }) {
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
  day: { height: MINUTES_PER_DAY * PX_PER_MIN },
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
