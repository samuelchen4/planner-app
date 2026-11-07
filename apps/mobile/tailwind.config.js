/** @type {import('tailwindcss').Config} */
module.exports = {
  // 'class', not the default 'media': NativeWind's web runtime throws on load in media mode.
  // Light/dark is driven by useColorScheme() + vars() in src/lib/theme.ts, so this changes nothing on iOS.
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset'), require('@planner/ui/tailwind-preset')],
  plugins: [],
};
