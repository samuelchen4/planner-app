import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { clearTables } from '@/db/tables';

import { supabase } from './supabase';

export const authRequired = Platform.OS !== 'web';

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function signOut() {
  await clearTables();
  await supabase.auth.signOut();
}
