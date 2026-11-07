import { normalizeSchedule, type ScheduleSettings } from '@planner/core';
import { createContext, use, useState, type ReactNode } from 'react';

interface SettingsValue {
  schedule: ScheduleSettings;
  /** Update part of the schedule. Input is normalized, so out-of-range values are clamped, not rejected. */
  setSchedule: (patch: Partial<ScheduleSettings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * App-wide user settings. Held in memory for now (resets on reload); a Settings screen calls
 * `setSchedule`, and persistence (synced per-user settings) slots in here later.
 */
export function SettingsProvider({
  children,
  initialSchedule,
}: {
  children: ReactNode;
  initialSchedule?: Partial<ScheduleSettings>;
}) {
  const [schedule, setScheduleState] = useState(() => normalizeSchedule(initialSchedule));
  const setSchedule = (patch: Partial<ScheduleSettings>) =>
    setScheduleState((prev) => normalizeSchedule({ ...prev, ...patch }));

  return <SettingsContext value={{ schedule, setSchedule }}>{children}</SettingsContext>;
}

export function useSettings(): SettingsValue {
  const value = use(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
