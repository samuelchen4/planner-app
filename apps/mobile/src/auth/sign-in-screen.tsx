import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const isCancel = (e: unknown) => (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED';

export function SignInScreen() {
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithApple();
    } catch (e) {
      if (!isCancel(e)) {
        console.warn('[auth] Sign in with Apple failed:', e);
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
          onPress={() => void onPress()}
        />
      </View>
    </View>
  );
}
