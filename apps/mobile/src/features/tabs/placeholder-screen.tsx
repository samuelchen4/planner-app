import { Card } from '@planner/ui';
import { ScrollView, Text } from 'react-native';

import { useTabBarSpace } from './glass-tab-bar';
import { useTabBarScrollTracker } from './tab-bar-scroll';

/** Stand-in screen for a tab that hasn't been designed yet. */
export function PlaceholderScreen({ title, body }: { title: string; body: string }) {
  const tabBarSpace = useTabBarSpace();
  const tracker = useTabBarScrollTracker();
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
      <Text className="font-rounded text-large-title text-ink font-bold">{title}</Text>
      <Card>
        <Text className="text-body text-muted">{body}</Text>
      </Card>
    </ScrollView>
  );
}
