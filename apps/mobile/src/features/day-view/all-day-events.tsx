import { cn } from '@planner/ui';
import { Pressable, Text, View } from 'react-native';

import { openItem } from '@/lib/open-item';

import { ANYTIME_ROW_GAP, ANYTIME_ROW_H } from './anytime-list';
import type { AllDayEvent } from './day-entries';
import { CalendarIcon } from './list-icon';
import { useCalendarTint } from './timeline-block';

// A day's all-day calendar events: rows like the all-day tasks below them (same height and font),
// in the calendar's colour, read-only (no check, no drag; a tap opens the details). Fixed heights:
// the canvas computes day heights from these.

/** Height of a day's all-day events, with the gap below them (0 when there are none). */
export const allDayEventsHeight = (n: number) =>
  n === 0 ? 0 : n * ANYTIME_ROW_H + n * ANYTIME_ROW_GAP;

export function AllDayEvents({ events }: { events: AllDayEvent[] }) {
  if (events.length === 0) return null;
  return (
    <View style={{ gap: ANYTIME_ROW_GAP, paddingBottom: ANYTIME_ROW_GAP }}>
      {events.map((event) => (
        <AllDayEventRow key={event.id} event={event} />
      ))}
    </View>
  );
}

function AllDayEventRow({ event }: { event: AllDayEvent }) {
  const tint = useCalendarTint(event.color);
  return (
    <Pressable
      onPress={() => openItem(event.id)}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, all day`}
      style={{ height: ANYTIME_ROW_H }}
      className="active:opacity-70"
    >
      <View
        className={cn('flex-1 flex-row overflow-hidden rounded-lg', !tint && 'bg-subtle/20')}
        style={tint ? { backgroundColor: tint.fill } : undefined}
      >
        <View
          className={cn('w-1', !tint && 'bg-subtle')}
          style={tint ? { backgroundColor: tint.stripe } : undefined}
        />
        <View className="flex-1 flex-row items-center pl-2 pr-1.5">
          <Text numberOfLines={1} className="text-footnote text-ink shrink font-semibold">
            {event.title}
          </Text>
          <CalendarIcon />
        </View>
      </View>
    </Pressable>
  );
}
