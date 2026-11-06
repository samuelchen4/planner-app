import { palette, themeVariables, type ColorScheme } from '@planner/ui';
import { vars } from 'nativewind';
import { useColorScheme } from 'react-native';

const themeStyles = {
  light: vars(themeVariables('light')),
  dark: vars(themeVariables('dark')),
};

export function useScheme(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** Style to put on the root view: sets the CSS variables every `bg-card`, `text-ink`… reads. */
export function useThemeStyle() {
  return themeStyles[useScheme()];
}

/** Raw hex colors, for props that don't take classNames (SF Symbol tints, native tabs, blur). */
export function useColors() {
  return palette[useScheme()];
}
