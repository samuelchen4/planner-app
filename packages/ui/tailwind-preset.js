// Shared Tailwind preset: mobile (NativeWind) and later web both extend this.
const { palette, typeScale } = require('./tokens');

const colors = Object.fromEntries(
  Object.keys(palette.light).map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors,
      fontSize: typeScale,
      fontFamily: {
        // SF Pro Rounded for friendly display text (large titles). Native uses only the first entry:
        // iOS maps 'ui-rounded' to the rounded system design. Web: Safari supports ui-rounded; others fall back.
        rounded: ['ui-rounded', 'SF Pro Rounded', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
    },
  },
};
