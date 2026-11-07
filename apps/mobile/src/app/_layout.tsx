import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { TopTabs } from 'expo-router/js-top-tabs';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GlassTabBar } from '@/features/tabs/glass-tab-bar';
import { TabBarScrollProvider } from '@/features/tabs/tab-bar-scroll';
import { SettingsProvider } from '@/lib/settings';
import { TABS } from '@/lib/tabs';
import { useColors, useScheme, useThemeStyle } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useScheme();
  const colors = useColors();
  const themeStyle = useThemeStyle();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={[{ flex: 1 }, themeStyle]}>
            {/* Swipeable pager of tabs (side by side, follows the finger) with a floating glass
                tab bar whose bubble tracks the swipe. Order comes from TABS. */}
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
          </View>
        </ThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
