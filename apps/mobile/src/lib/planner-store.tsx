import type { DayEntry } from '@planner/core';
import {
  createContext,
  use,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { mockDayEntries } from '@/features/day-view/mock-data';
import { mockListEntries } from '@/features/lists/mock-data';

interface PlannerStore {
  /** Every planner item (tasks, lists, list entries) and mirrored calendar event. */
  entries: DayEntry[];
  setEntries: Dispatch<SetStateAction<DayEntry[]>>;
}

const PlannerStoreContext = createContext<PlannerStore | null>(null);

/**
 * The app's planner data, shared by every screen (a list ticked on the Lists page is ticked on the
 * Today screen too). In memory with mock data for now; PowerSync's local database replaces it.
 */
export function PlannerStoreProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState(() => [...mockDayEntries, ...mockListEntries]);
  return <PlannerStoreContext value={{ entries, setEntries }}>{children}</PlannerStoreContext>;
}

export function usePlannerStore(): PlannerStore {
  const value = use(PlannerStoreContext);
  if (!value) throw new Error('usePlannerStore must be used inside <PlannerStoreProvider>');
  return value;
}
