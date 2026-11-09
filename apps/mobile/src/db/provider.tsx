import { useEffect, useState, type ReactNode } from 'react';

import { loadTables } from './tables';

/** Opens the database and loads the tables before showing the app (nothing renders until then). */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void loadTables().then(() => setReady(true));
  }, []);
  return ready ? children : null;
}
