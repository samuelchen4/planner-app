import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/react-native';

import { accessToken } from '@/auth/supabase';
import { config } from '@/lib/config';

export const connector: PowerSyncBackendConnector = {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const token = await accessToken();
    return token ? { endpoint: config.powerSyncUrl, token } : null;
  },

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;
    if (!config.apiUrl) throw new Error('No API URL set (EXPO_PUBLIC_API_URL): uploads wait');
    const token = await accessToken();
    if (!token) throw new Error('Not signed in: uploads wait');
    const batch = transaction.crud.map((op) => ({
      op: op.op,
      type: op.table,
      id: op.id,
      data: op.opData,
    }));
    const res = await fetch(`${config.apiUrl}/sync/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch }),
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}), will retry`);
    const result = (await res.json()) as { rejected?: unknown[] };
    if (result.rejected?.length)
      console.warn('[sync] The server skipped changes:', result.rejected);
    await transaction.complete();
  },
};
