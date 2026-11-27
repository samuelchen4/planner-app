import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { appScheme } from '@/features/calendars/connect';
import { useScheme } from '@/lib/theme';

import { supabase } from './supabase';

async function signInWithApple() {
  const nonce = randomUUID();
  const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple did not return an identity token');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce,
  });
  if (error) throw error;
}

/** Closed the sign-in browser without finishing. */
class Cancelled extends Error {}

/**
 * Google has no native iOS sheet: Google's page opens in an in-app browser, Supabase sends it back
 * to this app's scheme (planner:// or planner-local://, both allowed in Supabase's redirect URLs)
 * with a one-time code, and the code becomes a session (PKCE, see supabase.ts).
 */
async function signInWithGoogle() {
  const redirectTo = `${appScheme()}://auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Cancelled();
  const url = new URL(result.url);
  const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (failure) throw new Error(failure);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google sign-in came back without a code');
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
}

const isCancel = (e: unknown) =>
  e instanceof Cancelled || (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED';

/** Google's "G" mark. */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.11A11.99 11.99 0 0 0 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.29a12 12 0 0 0 0 10.78l4-3.11z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.61l4 3.11C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </Svg>
  );
}

export function SignInScreen() {
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: 'Apple' | 'Google', start: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await start();
    } catch (e) {
      if (!isCancel(e)) {
        console.warn(`[auth] Sign in with ${provider} failed:`, e);
        setError('Signing in didn’t work. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="bg-app flex-1 justify-between px-6"
      style={{ paddingTop: insets.top + 96, paddingBottom: insets.bottom + 32 }}
    >
      <View className="gap-2">
        <Text className="font-rounded text-large-title text-ink font-bold">Planner</Text>
        <Text className="text-body text-muted">
          Your day, tasks and habits in one place. Sign in to keep them backed up and in sync.
        </Text>
      </View>
      <View className="gap-3">
        {error && <Text className="text-footnote text-danger text-center">{error}</Text>}
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={{ height: 50, opacity: busy ? 0.6 : 1 }}
          onPress={() => void signIn('Apple', signInWithApple)}
        />
        <Pressable
          onPress={() => void signIn('Google', signInWithGoogle)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          className="border-border flex-row items-center justify-center gap-2 rounded-xl border bg-white active:opacity-70"
          style={{ height: 50, opacity: busy ? 0.6 : 1 }}
        >
          <GoogleMark />
          <Text style={{ color: '#1F1F1F', fontSize: 19, fontWeight: '500' }}>
            Sign in with Google
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
