import { TopTabs } from 'expo-router/js-top-tabs';

import { GlassTabBar } from '@/features/tabs/glass-tab-bar';
import { TabBarScrollProvider } from '@/features/tabs/tab-bar-scroll';
import { TABS } from '@/lib/tabs';
import { useColors } from '@/lib/theme';

/**
 * Swipeable pager of tabs (side by side, follows the finger) with a floating glass tab bar whose
 * bubble tracks the swipe. Order comes from TABS.
 */
export default function TabsLayout() {
  const colors = useColors();
  return (
    <TabBarScrollProvider>
      <TopTabs
        tabBarPosition="bottom"
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{ lazy: false, sceneStyle: { backgroundColor: colors.app } }}
      >
        {TABS.map((tab) => (
          <TopTabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </TopTabs>
    </TabBarScrollProvider>
  );
}
