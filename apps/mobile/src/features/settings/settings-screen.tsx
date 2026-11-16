import { Card } from '@planner/ui';
import { Alert, Pressable, ScrollView, Text } from 'react-native';

import { signOut, useSession } from '@/auth/session';
import { pendingUploads } from '@/db/database';
import { useTabBarSpace } from '@/features/tabs/glass-tab-bar';
import { useTabBarScrollTracker } from '@/features/tabs/tab-bar-scroll';

async function confirmSignOut() {
  const unsynced = await pendingUploads();
  const message = unsynced
    ? `${unsynced} change${unsynced === 1 ? ' hasn’t' : 's haven’t'} been backed up yet and will be lost. Your other data stays in your account.`
    : 'Your data stays in your account. Sign in again to get it back.';
  Alert.alert('Sign out?', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
  ]);
}

export function SettingsScreen() {
  const tabBarSpace = useTabBarSpace();
  const tracker = useTabBarScrollTracker();
  const session = useSession();
  const email = session?.user.email;

  return (
    <ScrollView
      className="bg-app flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
      scrollEventThrottle={16}
      onScrollBeginDrag={(e) => tracker.onBegin(e.nativeEvent.contentOffset.y)}
      onScroll={(e) => tracker.onScroll(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={() => tracker.onEnd()}
      onMomentumScrollBegin={(e) => tracker.onBegin(e.nativeEvent.contentOffset.y)}
      onMomentumScrollEnd={() => tracker.onEnd()}
    >
      <Text className="font-rounded text-large-title text-ink font-bold">Settings</Text>
      <Card className="gap-1">
        <Text className="text-footnote text-muted">Signed in with Apple</Text>
        {email && <Text className="text-body text-ink">{email}</Text>}
      </Card>
      {session && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void confirmSignOut()}
          className="bg-card rounded-card items-center py-3"
        >
          <Text className="text-body text-danger">Sign Out</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
