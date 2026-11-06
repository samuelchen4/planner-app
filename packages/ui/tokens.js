// Single source of truth for design tokens.
// CommonJS so the Tailwind preset (and later the web app's Tailwind config) can require it.

/** Semantic colors, per color scheme. Values are hex; Tailwind reads them as CSS variables. */
const palette = {
  light: {
    app: '#F4F4F8', // screen background (soft lavender-grey)
    card: '#FFFFFF', // raised surfaces
    ink: '#111114', // primary text
    muted: '#6E6E76', // secondary text / labels
    subtle: '#A1A1AA', // tertiary text, placeholder
    border: '#E5E5EA', // hairlines, dashed outlines
    accent: '#7C5CFA', // brand / selection
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
  },
  dark: {
    app: '#000000',
    card: '#1C1C1E',
    ink: '#F5F5F7',
    muted: '#98989F',
    subtle: '#636366',
    border: '#2C2C2E',
    accent: '#9D85FF',
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
  },
};

/** iOS-style type scale (matches Apple's default Dynamic Type sizes). [fontSize, lineHeight] in px. */
const typeScale = {
  'large-title': ['34px', '41px'],
  title1: ['28px', '34px'],
  title2: ['22px', '28px'],
  title3: ['20px', '25px'],
  headline: ['17px', '22px'],
  body: ['17px', '22px'],
  callout: ['16px', '21px'],
  subhead: ['15px', '20px'],
  footnote: ['13px', '18px'],
  caption: ['12px', '16px'],
};

/** '#7C5CFA' -> '124 92 250' (the channel format Tailwind's <alpha-value> needs) */
function hexToChannels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variables for a scheme, e.g. { '--color-card': '255 255 255', ... } */
function themeVariables(scheme) {
  return Object.fromEntries(
    Object.entries(palette[scheme]).map(([name, hex]) => [`--color-${name}`, hexToChannels(hex)]),
  );
}

module.exports = { palette, typeScale, themeVariables };
