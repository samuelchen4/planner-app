import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthGate } from '@/auth/auth-gate';
import { SettingsProvider } from '@/lib/settings';
import { useColors, useScheme, useThemeStyle } from '@/lib/theme';

/**
 * Root: providers, then a stack with the tab pager underneath, the item details sheet
 * (`item/[id]`) presented over it, and Settings' Calendars screen pushed onto it. The sheet is a
 * native iOS form sheet: it slides up from the bottom over the current screen and swipes down to
 * close.
 */
export default function RootLayout() {
  const scheme = useScheme();
  const colors = useColors();
  const themeStyle = useThemeStyle();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={[{ flex: 1 }, themeStyle]}>
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.app },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="item/[id]"
                  options={{
                    presentation: 'formSheet',
                    // Opens at full height (a sliver of the screen behind shows at the top);
                    // swiping down closes it.
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 24,
                    contentStyle: { backgroundColor: colors.app },
                  }}
                />
                <Stack.Screen
                  name="calendars"
                  options={{
                    headerShown: true,
                    title: 'Calendars',
                    headerBackTitle: 'Settings',
                    headerTintColor: colors.accent,
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: colors.app },
                    headerTitleStyle: { color: colors.ink },
                  }}
                />
                {/* The connect flow's return link: a blank, instant stop that goes straight back. */}
                <Stack.Screen
                  name="integrations/[result]"
                  options={{ animation: 'none', presentation: 'transparentModal' }}
                />
              </Stack>
            </AuthGate>
          </View>
        </ThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
