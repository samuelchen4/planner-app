import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import type { ExternalEntry } from '@/db/entries';
import { daysBetween, hexWithAlpha } from '@/features/day-view/event-days';
import { providerName } from '@/features/calendars/providers';
import { dateKey, formatTime, parseTimestamp } from '@/features/day-view/time';
import { useColors } from '@/lib/theme';

import { dayLabel, FieldRow, Separator } from './fields';

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** 'Sun, Nov 22, 10:30 PM' (with "Today"/"Tomorrow" where it applies). */
const moment = (d: Date) => `${dayLabel(dateKey(d))}, ${formatTime(minutesOf(d))}`;

/** When it happens, as rows of [icon, label, value]. */
function whenRows(event: ExternalEntry['event']): [SFSymbol, string, string][] {
  if (event.start_at) {
    const start = parseTimestamp(event.start_at);
    const end = event.end_at ? parseTimestamp(event.end_at) : null;
    // Its last moment (an end at midnight belongs to the day before).
    const last = end && end > start ? new Date(end.getTime() - 1) : start;
    if (!end || dateKey(last) === dateKey(start)) {
      return [
        ['calendar', 'Date', dayLabel(dateKey(start))],
        [
          'clock',
          'Time',
          end
            ? `${formatTime(minutesOf(start))} – ${formatTime(minutesOf(end))}`
            : formatTime(minutesOf(start)),
        ],
      ];
    }
    // Runs over several days: start and end each with their day.
    return [
      ['calendar', 'Starts', moment(start)],
      ['calendar', 'Ends', moment(end)],
    ];
  }
  const days = event.all_day_start ? daysBetween(event.all_day_start, event.all_day_end) : [];
  if (days.length > 1) {
    return [
      ['calendar', 'Starts', dayLabel(days[0])],
      ['calendar', 'Ends', dayLabel(days[days.length - 1])],
      ['clock', 'Time', 'All day'],
    ];
  }
  return [
    ['calendar', 'Date', dayLabel(days[0])],
    ['clock', 'Time', 'All day'],
  ];
}

/**
 * Event descriptions from Google can hold a little HTML (line breaks, links, bold): shown as plain
 * text.
 */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A mirrored calendar event: read-only (it's edited at its provider). */
export function EventDetails({ entry }: { entry: ExternalEntry }) {
  const colors = useColors();
  const { event, calendar, account } = entry;
  const source = providerName(event.provider);
  const linkLabel = `Open in ${providerName(event.provider, 'calendar')}`;
  const rows = whenRows(event);
  const notes = event.description ? plainText(event.description) : '';
  const location = event.location?.trim();
  const dot = hexWithAlpha(calendar?.color, 1) ?? colors.subtle;

  return (
    <>
      <Text selectable className="font-rounded text-title2 text-ink font-bold">
        {event.title.trim() || '(No title)'}
      </Text>

      <View className="bg-card rounded-card overflow-hidden">
        {rows.map(([icon, label, value], i) => (
          <View key={label}>
            {i > 0 && <Separator />}
            <FieldRow icon={icon} label={label} value={value} />
          </View>
        ))}
        {event.status === 'tentative' && (
          <>
            <Separator />
            <FieldRow icon="questionmark.circle" label="Status" value="Tentative" />
          </>
        )}
      </View>

      <View className="bg-card rounded-card overflow-hidden">
        {location && (
          <>
            <InfoRow icon="mappin.and.ellipse" label="Location">
              <Text selectable className="text-body text-ink">
                {location}
              </Text>
            </InfoRow>
            <Separator />
          </>
        )}
        <InfoRow icon="calendar.badge.clock" label="Calendar">
          <View className="flex-row items-center gap-2">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
            <Text className="text-body text-ink shrink" numberOfLines={1}>
              {calendar?.name || source}
            </Text>
          </View>
          {account && (
            <Text className="text-footnote text-muted" numberOfLines={1}>
              {account.email}
            </Text>
          )}
        </InfoRow>
      </View>

      {notes ? (
        <View className="bg-card rounded-card gap-1 px-4 py-3">
          <Text className="text-footnote text-muted">Notes</Text>
          <Text selectable className="text-body text-ink">
            {notes}
          </Text>
        </View>
      ) : null}

      {event.web_link && (
        <Pressable
          onPress={() => void Linking.openURL(event.web_link!)}
          accessibilityRole="link"
          className="bg-card rounded-card min-h-11 flex-row items-center justify-center gap-2 py-3 active:opacity-60"
        >
          <SymbolView name="arrow.up.right.square" size={16} tintColor={colors.accent} />
          <Text className="text-body text-accent">{linkLabel}</Text>
        </Pressable>
      )}

      <Text className="text-footnote text-subtle px-1">From {source} · read-only</Text>
    </>
  );
}

/** A read-only row: icon, a small label, and its value below (which can wrap). */
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: SFSymbol;
  label: string;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View className="min-h-12 flex-row items-start gap-3 px-4 py-3">
      <View style={{ paddingTop: 2 }}>
        <SymbolView name={icon} size={18} tintColor={colors.accent} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-footnote text-muted">{label}</Text>
        {children}
      </View>
    </View>
  );
}
