import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { View } from 'react-native';

import { useColors, useScheme, useThemeStyle } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useScheme();
  const colors = useColors();
  const themeStyle = useThemeStyle();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={[{ flex: 1 }, themeStyle]}>
        <NativeTabs tintColor={colors.accent} minimizeBehavior="onScrollDown">
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="today" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
    </ThemeProvider>
  );
}
