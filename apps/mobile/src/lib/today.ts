import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dateKey } from '@/features/day-view/time';

/**
 * Today's date as 'YYYY-MM-DD', updated at midnight and whenever the app comes back to the
 * foreground (iOS keeps the app alive in the background, so it can reopen days later).
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => dateKey(new Date()));

  useEffect(() => {
    const refresh = () => setKey(dateKey(new Date()));

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, midnight.getTime() - now.getTime() + 1000);
    };
    scheduleMidnight();

    // Timers don't run while suspended; check again on return.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh();
      clearTimeout(timer);
      scheduleMidnight();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return key;
}
