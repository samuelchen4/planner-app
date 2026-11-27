import type { CalendarProvider } from '@/db/schema';

/** What each calendar provider is called in the app. */
export const PROVIDER_NAME: Record<CalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Outlook',
};

/** The Calendars screen's connect button for each provider. */
export const CONNECT_LABEL: Record<CalendarProvider, string> = {
  google: 'Connect Google Calendar',
  microsoft: 'Connect Outlook Calendar',
};

/** The providers the Calendars screen offers to connect, in order. */
export const CONNECTABLE_PROVIDERS: readonly CalendarProvider[] = ['google', 'microsoft'];

/** A provider's display name, or `fallback` for one the app doesn't know (yet). */
export function providerName(provider: string, fallback = 'your calendar'): string {
  return (PROVIDER_NAME as Record<string, string>)[provider] ?? fallback;
}
