import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Where the backend's connect redirect lands (`<scheme>://integrations/done` or `/error`). On iOS
 * the auth session catches it before the app does; if the link ever opens the app (Android, or a
 * stale browser tab), this goes straight back, so it never shows a "not found" screen. The
 * Calendars screen reads the outcome from the auth session itself.
 */
export default function IntegrationsRedirect() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
