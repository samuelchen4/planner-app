import { cn } from '@planner/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { setCalendarSelected } from '@/db/calendars';
import type { Calendar, CalendarAccount, CalendarProvider } from '@/db/schema';
import { useCalendarAccounts, useCalendars } from '@/db/tables';
import { hexWithAlpha } from '@/features/day-view/event-days';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

import { connectCalendar, disconnectAccount } from './connect';
import { CONNECT_LABEL, CONNECTABLE_PROVIDERS, providerName } from './providers';

/** How long "Getting your calendars…" waits for the new account to sync in. */
const SYNC_WAIT_MS = 30_000;

/**
 * Settings → Calendars: connected accounts with their calendars (a switch each, which shows or
 * hides that calendar's events in the day view), Reconnect / Disconnect, and Connect Google
 * Calendar / Outlook.
 */
export function CalendarsScreen() {
  const accounts = useCalendarAccounts();
  const calendars = useCalendars();
  /** The provider whose connect flow is running. */
  const [connecting, setConnecting] = useState<CalendarProvider | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  // After a successful connect: the account count then. "Getting your calendars…" shows until
  // there are more accounts than that (it syncs in) or SYNC_WAIT_MS passes.
  const [waitingFrom, setWaitingFrom] = useState<{ count: number } | null>(null);
  const awaitingSync = waitingFrom !== null && accounts.length <= waitingFrom.count;
  useEffect(() => {
    if (!waitingFrom) return;
    const t = setTimeout(() => setWaitingFrom(null), SYNC_WAIT_MS);
    return () => clearTimeout(t);
  }, [waitingFrom]);

  const calendarsByAccount = useMemo(() => {
    const map = new Map<string, Calendar[]>();
    for (const c of calendars) {
      if (c.is_planner_calendar) continue;
      const list = map.get(c.account_id);
      if (list) list.push(c);
      else map.set(c.account_id, [c]);
    }
    return map;
  }, [calendars]);

  const connect = async (provider: CalendarProvider, reconnecting = false) => {
    if (connecting) return;
    setConnecting(provider);
    setMessage(null);
    const before = accounts.length;
    const result = await connectCalendar(provider);
    setConnecting(null);
    if (result.status === 'connected') {
      haptics.check();
      // A new account syncs in within seconds (it may already have).
      if (!reconnecting) setWaitingFrom({ count: before });
    } else if (result.status === 'cancelled') {
      setMessage({
        tone: 'info',
        text: `${providerName(provider)} not connected. You can connect it any time.`,
      });
    } else {
      setMessage({ tone: 'error', text: result.message });
    }
  };

  return (
    <ScrollView
      className="bg-app flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-16 pt-4"
    >
      {accounts.length === 0 && !awaitingSync ? (
        <EmptyState />
      ) : (
        accounts.map((account) => (
          <AccountSection
            key={account.id}
            account={account}
            calendars={calendarsByAccount.get(account.id) ?? []}
            busy={connecting !== null}
            onReconnect={() => void connect(account.provider, true)}
          />
        ))
      )}

      {awaitingSync && (
        <View className="flex-row items-center justify-center gap-2 py-2">
          <ActivityIndicator size="small" />
          <Text className="text-subhead text-muted">Getting your calendars…</Text>
        </View>
      )}

      <View className="gap-2">
        {CONNECTABLE_PROVIDERS.map((provider) => (
          <ConnectButton
            key={provider}
            provider={provider}
            connecting={connecting === provider}
            disabled={connecting !== null}
            onPress={() => void connect(provider)}
          />
        ))}
        {message && (
          <Text
            className={cn(
              'text-footnote px-1 text-center',
              message.tone === 'error' ? 'text-danger' : 'text-muted',
            )}
          >
            {message.text}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View className="bg-card rounded-card items-center gap-2 px-6 py-8">
      <SymbolView name="calendar" size={32} tintColor={colors.subtle} />
      <Text className="text-headline text-ink font-semibold">No calendars connected</Text>
      <Text className="text-subhead text-muted text-center">
        Connect Google Calendar or Outlook to see your events on the Today screen, next to your
        tasks.
      </Text>
    </View>
  );
}

function ConnectButton({
  provider,
  connecting,
  disabled,
  onPress,
}: {
  provider: CalendarProvider;
  connecting: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ busy: connecting, disabled }}
      className="bg-card rounded-card min-h-11 flex-row items-center justify-center gap-2 py-3 active:opacity-60"
    >
      {connecting ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <SymbolView name="plus" size={15} weight="semibold" tintColor={colors.accent} />
      )}
      <Text className="text-body text-accent font-semibold">
        {connecting ? 'Connecting…' : CONNECT_LABEL[provider]}
      </Text>
    </Pressable>
  );
}

function AccountSection({
  account,
  calendars,
  busy,
  onReconnect,
}: {
  account: CalendarAccount;
  calendars: Calendar[];
  /** A connect flow is running: Reconnect waits. */
  busy: boolean;
  onReconnect: () => void;
}) {
  const colors = useColors();
  const [disconnecting, setDisconnecting] = useState(false);
  const needsReconnect = account.status !== 'active';

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectAccount(account.id);
      // The account leaves through sync shortly; until then it stays greyed out.
    } catch (e) {
      setDisconnecting(false);
      Alert.alert('Couldn’t disconnect', e instanceof Error ? e.message : 'Please try again.');
    }
  };
  const confirmDisconnect = () =>
    Alert.alert(
      `Disconnect ${account.email}?`,
      `Its calendars and events will be removed from Planner. Nothing changes in ${providerName(account.provider)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void disconnect() },
      ],
    );

  return (
    <View className="gap-2" style={{ opacity: disconnecting ? 0.5 : 1 }}>
      <View className="flex-row items-end justify-between gap-2 px-1">
        <View className="shrink">
          <Text className="text-footnote text-muted uppercase">
            {providerName(account.provider, account.provider)}
          </Text>
          <Text className="text-subhead text-ink font-semibold" numberOfLines={1}>
            {account.email}
          </Text>
        </View>
        {disconnecting && <Text className="text-footnote text-muted">Disconnecting…</Text>}
      </View>

      <View className="bg-card rounded-card overflow-hidden">
        {needsReconnect && (
          <>
            <View className="flex-row items-center gap-3 px-4 py-3">
              <SymbolView
                name="exclamationmark.triangle.fill"
                size={16}
                tintColor={colors.warning}
              />
              <View className="flex-1">
                <Text className="text-body text-ink">Needs reconnecting</Text>
                <Text className="text-footnote text-muted">
                  Events from this account aren’t updating.
                </Text>
              </View>
              <Pressable
                onPress={onReconnect}
                disabled={busy || disconnecting}
                accessibilityRole="button"
                hitSlop={8}
                className="active:opacity-60"
              >
                <Text className="text-body text-accent font-semibold">Reconnect</Text>
              </Pressable>
            </View>
            <Hairline inset={16} />
          </>
        )}

        {calendars.length === 0 ? (
          <Text className="text-subhead text-muted px-4 py-3">No calendars yet</Text>
        ) : (
          calendars.map((calendar, i) => (
            <View key={calendar.id}>
              {i > 0 && <Hairline inset={40} />}
              <CalendarRow calendar={calendar} disabled={disconnecting} />
            </View>
          ))
        )}

        <Hairline inset={0} />
        <Pressable
          onPress={confirmDisconnect}
          disabled={disconnecting}
          accessibilityRole="button"
          className="min-h-11 items-center justify-center py-3 active:opacity-60"
        >
          <Text className="text-body text-danger">Disconnect</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CalendarRow({ calendar, disabled }: { calendar: Calendar; disabled: boolean }) {
  const colors = useColors();
  const dot = hexWithAlpha(calendar.color, 1) ?? colors.subtle;
  return (
    <View className="min-h-12 flex-row items-center gap-3 py-2 pl-4 pr-3">
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View className="flex-1">
        <Text className="text-body text-ink" numberOfLines={1}>
          {calendar.name || 'Untitled calendar'}
        </Text>
        {calendar.is_primary && <Text className="text-footnote text-muted">Primary</Text>}
      </View>
      <Switch
        value={calendar.is_selected}
        onValueChange={(on) => setCalendarSelected(calendar.id, on)}
        disabled={disabled}
        trackColor={{ true: colors.accent }}
        accessibilityLabel={`Show ${calendar.name || 'calendar'} events`}
      />
    </View>
  );
}

function Hairline({ inset }: { inset: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: inset,
      }}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6 },
});
