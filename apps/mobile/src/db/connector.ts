import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/react-native';

import { accessToken } from '@/auth/supabase';
import { config } from '@/lib/config';

import { toUploadChange } from './upload-batch';

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
    const batch = transaction.crud.flatMap((op) => {
      const change = toUploadChange({ op: op.op, table: op.table, id: op.id, opData: op.opData });
      return change ? [change] : [];
    });
    // Nothing the server takes (e.g. a stray write to a server-only table): done.
    if (!batch.length) {
      await transaction.complete();
      return;
    }
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
