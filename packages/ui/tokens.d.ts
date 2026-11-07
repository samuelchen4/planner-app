export type ColorScheme = 'light' | 'dark';
export type ColorToken =
  | 'app'
  | 'card'
  | 'ink'
  | 'muted'
  | 'subtle'
  | 'border'
  | 'accent'
  | 'on-accent'
  | 'done'
  | 'success'
  | 'warning'
  | 'danger';

export declare const palette: Record<ColorScheme, Record<ColorToken, string>>;
export declare const typeScale: Record<string, [fontSize: string, lineHeight: string]>;
export declare function themeVariables(
  scheme: ColorScheme,
): Record<`--color-${ColorToken}`, string>;
