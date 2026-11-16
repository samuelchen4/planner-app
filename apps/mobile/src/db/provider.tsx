import { useEffect, useState, type ReactNode } from 'react';

import { loadTables } from './tables';

export function DatabaseProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void loadTables(userId).then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);
  return ready ? children : null;
}
