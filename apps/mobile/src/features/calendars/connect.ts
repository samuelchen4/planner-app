import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { accessToken } from '@/auth/supabase';
import type { CalendarProvider } from '@/db/schema';
import { config } from '@/lib/config';

import { providerName } from './providers';

// Connecting and disconnecting calendar accounts through the backend (/integrations). The account,
// its calendars and their events then arrive (or leave) through PowerSync.

/** The return schemes the backend accepts (planner-backend src/calendars/state.ts). */
const RETURN_SCHEMES = ['planner', 'planner-local'] as const;
type ReturnScheme = (typeof RETURN_SCHEMES)[number];

/**
 * This app's URL scheme, from its config: 'planner-local' for the local variant (APP_VARIANT=local,
 * app.config.ts), 'planner' otherwise.
 */
export function appScheme(): ReturnScheme {
  const configured = Constants.expoConfig?.scheme;
  const schemes = Array.isArray(configured) ? configured : configured ? [configured] : [];
  return (
    schemes.find((s): s is ReturnScheme => (RETURN_SCHEMES as readonly string[]).includes(s)) ??
    'planner'
  );
}

export type ConnectResult =
  | { status: 'connected' }
  /** The user closed the browser, or declined on the provider's consent screen. */
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

async function api(path: string, init: RequestInit): Promise<Response> {
  const token = await accessToken();
  if (!token) throw new Error('You’re signed out. Sign in again and retry.');
  try {
    return await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Couldn’t reach Planner. Check your connection and try again.');
  }
}

/** The `reason` of an error redirect, e.g. 'access_denied'. */
function reasonOf(url: string): string | null {
  const match = /[?&]reason=([^&#]*)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Connect (or reconnect) a calendar account: the backend gives an OAuth URL, which opens in an
 * in-app browser session; the backend's callback redirects back to `<scheme>://integrations/done`
 * (or `/error?reason=…`), which closes the session.
 */
export async function connectCalendar(provider: CalendarProvider): Promise<ConnectResult> {
  const name = providerName(provider);
  try {
    const scheme = appScheme();
    const res = await api(`/integrations/${provider}/start`, {
      method: 'POST',
      body: JSON.stringify({ returnScheme: scheme }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return {
        status: 'failed',
        message:
          res.status === 503
            ? `${name} isn’t available yet.`
            : (body?.error ?? `Couldn’t start connecting ${name} (${res.status}).`),
      };
    }
    const { url } = (await res.json()) as { url: string };
    const result = await WebBrowser.openAuthSessionAsync(url, `${scheme}://integrations`);
    if (result.type !== 'success') return { status: 'cancelled' };
    if (/:\/\/integrations\/done/.test(result.url)) return { status: 'connected' };
    const reason = reasonOf(result.url);
    if (reason === 'access_denied') return { status: 'cancelled' };
    return {
      status: 'failed',
      message: `${name} didn’t connect${reason && reason !== 'connect_failed' ? ` (${reason})` : ''}. Please try again.`,
    };
  } catch (e) {
    return {
      status: 'failed',
      message: e instanceof Error ? e.message : `Couldn’t connect ${name}.`,
    };
  }
}

/** Disconnect an account; the backend removes it with its calendars and events (via sync). */
export async function disconnectAccount(id: string): Promise<void> {
  const res = await api(`/integrations/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  // Already gone counts as done.
  if (!res.ok && res.status !== 404) throw new Error(`Couldn’t disconnect (${res.status}).`);
}
