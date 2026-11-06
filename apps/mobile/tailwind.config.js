/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset'), require('@planner/ui/tailwind-preset')],
  plugins: [],
};
