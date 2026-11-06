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
      borderRadius: {
        card: '20px',
      },
    },
  },
};
