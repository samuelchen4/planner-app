import type { SFSymbol } from 'expo-symbols';

/**
 * The tabs, in order. Single source for the swipeable tab pager in `src/app/_layout.tsx` and the
 * glass tab bar (`GlassTabBar`): reorder here and both follow. `name` is the route file in src/app.
 */
export const TABS = [
  { name: 'index', label: 'Today', sf: { default: 'calendar', selected: 'calendar' } },
  { name: 'habits', label: 'Habits', sf: { default: 'flame', selected: 'flame.fill' } },
  { name: 'lists', label: 'Lists', sf: { default: 'checklist', selected: 'checklist' } },
  {
    name: 'settings',
    label: 'Settings',
    sf: { default: 'gearshape', selected: 'gearshape.fill' },
  },
] as const satisfies readonly {
  name: string;
  label: string;
  sf: { default: SFSymbol; selected: SFSymbol };
}[];
