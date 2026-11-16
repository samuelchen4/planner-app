import type { ReactNode } from 'react';

import { DatabaseProvider } from '@/db/provider';

import { authRequired, useSession } from './session';
import { SignInScreen } from './sign-in-screen';

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  if (!authRequired) return <DatabaseProvider userId="me">{children}</DatabaseProvider>;
  if (session === undefined) return null;
  if (!session) return <SignInScreen />;
  return <DatabaseProvider userId={session.user.id}>{children}</DatabaseProvider>;
}
